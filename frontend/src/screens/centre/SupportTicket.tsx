'use client';
/*
 * Chioni — /centre/support/[id] : le fil d'une demande d'aide (S5 lot 3).
 *
 * Trois choses que cet écran doit dire, et qu'il dit :
 *
 * 1. **Qui parle.** Les deux côtés sont visuellement distincts : le centre à
 *    gauche avec le nom du collègue (que le lecteur voit déjà dans
 *    « Personnel »), Chioni à droite sans nom d'agent — `author_display` vaut
 *    `null` côté `chioni` par contrat, et l'interlocuteur du centre est
 *    « Chioni », pas une personne.
 * 2. **L'avertissement de confidentialité au moment d'écrire**, à côté du
 *    champ, pas dans une aide repliée.
 * 3. **Ce que l'état du ticket change.** `ferme` refuse tout nouveau message
 *    et toute nouvelle pièce : le fil passe en lecture seule AVANT que
 *    quelqu'un ne se prenne un 400, avec le geste utile (« ouvrir un nouveau
 *    ticket »). `resolu` accepte encore un message et ne se rouvre pas tout
 *    seul — l'écran ne promet donc aucun changement d'état après l'envoi.
 *
 * Le centre ne change JAMAIS le statut : aucune route tenant n'existe pour ça,
 * et aucun sélecteur n'est construit. Même chose pour la priorité, déclarée à
 * l'ouverture et figée ensuite.
 *
 * Pièces jointes : dropzone Vireo (`ax-dropzone` de `forms/FileUpload`) déjà
 * adaptée en S3/S4 (documents patients, pièces KYC), socle ADR 0014 tel quel
 * (JPEG/PNG/WebP réels, 2 Mo, EXIF strippé), **PDF refusé et dit**, et
 * téléchargement par `apiDownload` — le stockage est privé, aucune URL
 * n'existe.
 */
import { useRef, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import { ApiError } from '@/lib/api';
import {
  downloadSupportAttachment,
  getSupportTicket,
  postSupportMessage,
  uploadSupportAttachment,
} from '@/lib/endpoints/centers';
import {
  SUPPORT_ALWAYS_OPEN_NOTICE,
  SUPPORT_ATTACHMENT_HINT,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_CHIONI_AUTHOR,
  SUPPORT_CLOSED_NOTICE,
  SUPPORT_NEW_TICKET_ACTION,
  SUPPORT_NO_NOTIFICATION_NOTICE,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_RESOLVED_NOTICE,
  SUPPORT_SIDE_LABELS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_READONLY_NOTICE,
  UPLOAD_FORMAT_REFUSED,
  UPLOAD_IMAGE_HINT,
  formatBytes,
  formatDateTime,
  supportAttachmentLabel,
  uploadThrottled,
  uploadTooLarge,
} from '@/lib/labels';
import type { SupportMessage } from '@/lib/types';
import {
  CardSkeleton,
  DetailItem,
  ErrorAlert,
  FieldError,
  IconPlus,
  SUPPORT_PRIORITY_TONES,
  SUPPORT_TONES,
  StatusBadge,
  /* Le MÊME bloc que la modale d'ouverture — cet écran le recopiait à la main
     et les deux copies avaient déjà divergé (celle-ci était restée en
     `ax-alert--warning`). Il vit dans le socle : deux portes d'écriture, un
     seul texte, et aucun couplage de bundle entre la liste et le fil. */
  SupportPrivacyNotice,
  toApiError,
  useAsync,
} from './shared';

/** Formats réellement acceptés par le backend (socle ADR 0014 tel quel). */
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

/** 429 du scope `uploads` (20/h, partagé avatar/logo/documents/pièces KYC). */
function toUploadError(err: unknown): ApiError {
  const e = toApiError(err);
  if (e.status === 429) return new ApiError(429, [uploadThrottled(e.retryAfterSeconds)]);
  return e;
}

const DOWNLOAD_ICON = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
    <path d="M7 11l5 5l5 -5" />
    <path d="M12 4l0 12" />
  </svg>
);

/* ── une bulle du fil ── */

function MessageBubble({ message }: { message: SupportMessage }) {
  const fromCenter = message.author_side === 'centre';
  return (
    <li
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: fromCenter ? 'flex-start' : 'flex-end',
        gap: 4,
      }}
    >
      {/*
       * Revue UX care S5 — « qui parle » doit tenir sur un petit écran Android.
       * À 92 % de large, les deux bulles occupent presque toute la ligne et
       * l'alignement gauche/droite ne dit plus rien ; les deux fonds
       * (`surface-subtle` / `accent-wash`) sont par ailleurs très proches.
       * Deux signaux ajoutés, qui ne coûtent pas un octet de réseau : une
       * largeur qui laisse voir le décalage (82 %) et un liseré accentué du
       * côté de Chioni. Le nom sous la bulle reste le signal principal — la
       * couleur ne porte jamais l'information seule.
       */}
      <div
        style={{
          maxWidth: 'min(560px, 82%)',
          padding: 'var(--ax-space-3) var(--ax-space-4)',
          borderRadius: 'var(--ax-radius-md)',
          background: fromCenter ? 'var(--ax-surface-subtle)' : 'var(--ax-accent-wash)',
          border: '1px solid var(--ax-border)',
          borderInlineEndWidth: fromCenter ? undefined : 3,
          borderInlineEndColor: fromCenter ? undefined : 'var(--ax-accent)',
          color: 'var(--ax-text)',
          fontSize: 'var(--ax-text-sm)',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {message.body}
      </div>
      <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
        {/* `author_display` est `null` côté Chioni PAR CONTRAT : on nomme
            l'équipe, jamais un agent. */}
        <b style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>
          {fromCenter
            ? (message.author_display ?? SUPPORT_SIDE_LABELS.centre)
            : SUPPORT_CHIONI_AUTHOR}
        </b>
        {' · '}
        {formatDateTime(message.created_at)}
      </span>
    </li>
  );
}

/* ── dépôt d'une pièce ── */

function AttachmentForm({
  centerId,
  ticketId,
  onUploaded,
}: {
  centerId: number;
  ticketId: number;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileIssue, setFileIssue] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const pick = (picked: File | null) => {
    setError(null);
    if (!picked) return;
    if (!ACCEPTED_MIME.includes(picked.type)) {
      setFile(null);
      setFileIssue(UPLOAD_FORMAT_REFUSED);
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setFileIssue(uploadTooLarge(picked.size));
      return;
    }
    setFileIssue(null);
    setFile(picked);
  };

  const submit = async () => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      await uploadSupportAttachment(centerId, ticketId, file);
      setFile(null);
      onUploaded();
    } catch (err) {
      setError(toUploadError(err));
    }
    setSaving(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0] ?? null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
      {error && error.messages.length > 0 && <ErrorAlert error={error} />}
      {/* `is-dragover` va sur le WRAPPER : le design system cible
          `.ax-dropzone.is-dragover .ax-dropzone__area`. (Les dropzones de S3/S4
          le posent sur la zone elle-même et n'obtiennent donc aucun retour
          visuel au survol — signalé, pas corrigé ici : hors périmètre S5.) */}
      <div className={`ax-dropzone${dragging ? ' is-dragover' : ''}`}>
        <div
          className="ax-dropzone__area"
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label="Choisir une capture d’écran"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" />
            <path d="M9 15l3 -3l3 3" />
            <path d="M12 12l0 9" />
          </svg>
          <div style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>
            {file ? file.name : dragging ? 'Déposez l’image ici' : 'Capture d’écran — cliquez ou déposez ici'}
          </div>
          {/* Formats et poids acceptés = de l'information, pas de la décoration :
              `--ax-text-muted` (AA) et non `--ax-text-subtle` (4,32:1). */}
          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
            {file ? `${formatBytes(file.size)} · cliquez pour remplacer` : UPLOAD_IMAGE_HINT}
          </div>
          <input
            type="file"
            ref={inputRef}
            accept="image/jpeg,image/png,image/webp"
            className="visually-hidden"
            onChange={(e) => {
              pick(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
        {fileIssue && (
          <p className="ax-field__message ax-field__message--error" role="alert" style={{ marginTop: 'var(--ax-space-2)' }}>
            {fileIssue}
          </p>
        )}
        <FieldError error={error} field="file" />
        <p className="ax-field__message">{SUPPORT_ATTACHMENT_HINT}</p>
      </div>
      <div>
        <button
          type="button"
          className="ax-btn ax-btn--secondary ax-btn--sm"
          onClick={() => void submit()}
          disabled={saving || !file}
        >
          <IconPlus />
          <span className="ax-btn__label">{saving ? 'Envoi…' : 'Joindre cette image'}</span>
        </button>
      </div>
    </div>
  );
}

/* ── écran ── */

export function SupportTicketScreen({ ticketId }: { ticketId: number }) {
  const { centerId } = useCenter();
  const state = useAsync(() => getSupportTicket(centerId, ticketId), [centerId, ticketId]);

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ApiError | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);

  const ticket = state.data;

  const send = async () => {
    if (!ticket || body.trim().length === 0) return;
    setSending(true);
    setSendError(null);
    try {
      await postSupportMessage(centerId, ticket.id, body.trim());
      setBody('');
      state.reload();
    } catch (err) {
      setSendError(toApiError(err));
    }
    setSending(false);
  };

  const download = async (attachmentId: number) => {
    if (!ticket) return;
    setDownloadingId(attachmentId);
    setDownloadError(null);
    try {
      await downloadSupportAttachment(centerId, ticket.id, attachmentId);
    } catch (err) {
      setDownloadError(toApiError(err));
    }
    setDownloadingId(null);
  };

  if (state.loading || !ticket) {
    return (
      <>
        <PageHead title="Demande d’aide" />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              {state.error ? (
                <ErrorAlert error={state.error} onRetry={state.reload} />
              ) : (
                <CardSkeleton lines={6} />
              )}
            </div>
          </section>
        </div>
      </>
    );
  }

  const closed = ticket.status === 'ferme';

  return (
    <>
      <PageHead
        title={ticket.subject}
        subtitle={`${SUPPORT_CATEGORY_LABELS[ticket.category]} · ouvert le ${formatDateTime(ticket.created_at)}`}
      />

      <div className="ax-dash-grid">
        {/* ── le fil ── */}
        <section className="ax-card ax-col--8" role="region" aria-label="Fil de la discussion">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Discussion</h2>
              <p className="ax-card__subtitle">
                {SUPPORT_SIDE_LABELS.centre} à gauche, {SUPPORT_SIDE_LABELS.chioni} à droite.
              </p>
            </div>
            <StatusBadge tone={SUPPORT_TONES[ticket.status]} label={SUPPORT_STATUS_LABELS[ticket.status]} />
          </div>
          <div
            className="ax-card__body"
            style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}
          >
            {ticket.messages.length === 0 ? (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                Aucun message pour l’instant. Écrivez ci-dessous ce qu’il se passe.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                {ticket.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </ul>
            )}

            {/* Un ticket résolu accepte encore un message et ne se rouvre pas
                tout seul : le dire évite d'attendre un changement d'état. */}
            {ticket.status === 'resolu' && (
              <div className="ax-alert ax-alert--info" role="status">
                <div className="ax-alert__content">
                  <p className="ax-alert__message">{SUPPORT_RESOLVED_NOTICE}</p>
                </div>
              </div>
            )}

            {closed ? (
              <div className="ax-alert ax-alert--info" role="status">
                <div className="ax-alert__content">
                  <p className="ax-alert__message">{SUPPORT_CLOSED_NOTICE}</p>
                  <div className="ax-alert__actions">
                    {/* La sortie est un GESTE, pas un lien de retour : `?nouveau=1`
                        ouvre le formulaire à l'arrivée. Renvoyer quelqu'un vers
                        la liste, à lui de retrouver le bouton, c'est lui faire
                        refaire le chemin. */}
                    <Link href="/centre/support?nouveau=1" className="ax-btn ax-btn--secondary ax-btn--sm">
                      <IconPlus />
                      <span className="ax-btn__label">{SUPPORT_NEW_TICKET_ACTION}</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}
              >
                {sendError && sendError.messages.length > 0 && <ErrorAlert error={sendError} />}
                {/* L'avertissement de confidentialité, JUSTE au-dessus du
                    champ : c'est le moment où quelqu'un pourrait écrire un nom
                    de patient. */}
                <SupportPrivacyNotice />
                <div className="ax-field">
                  <label className="ax-label" htmlFor="support-reply">
                    Votre message
                  </label>
                  <textarea
                    id="support-reply"
                    className={`ax-input${sendError?.fieldErrors.body ? ' is-invalid' : ''}`}
                    rows={4}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={5000}
                    placeholder="Ajoutez une précision, ou dites si le problème persiste"
                    aria-describedby="support-reply-help"
                  />
                  <p id="support-reply-help" className="ax-field__message">
                    {SUPPORT_NO_NOTIFICATION_NOTICE}
                  </p>
                  <FieldError error={sendError} field="body" />
                </div>
                <div>
                  <button
                    type="submit"
                    className="ax-btn ax-btn--primary"
                    disabled={sending || body.trim().length === 0}
                  >
                    <span className="ax-btn__label">{sending ? 'Envoi…' : 'Envoyer'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* ── contexte + pièces jointes ── */}
        <aside
          className="ax-col--4"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0, alignSelf: 'start' }}
        >
          <section className="ax-card" role="region" aria-label="Détail de la demande">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">La demande</h2>
              </div>
            </div>
            <div
              className="ax-card__body"
              style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--ax-space-4)' }}>
                <DetailItem label="Sujet">{SUPPORT_CATEGORY_LABELS[ticket.category]}</DetailItem>
                <DetailItem label="Urgence déclarée">
                  <StatusBadge
                    tone={SUPPORT_PRIORITY_TONES[ticket.priority]}
                    label={SUPPORT_PRIORITY_LABELS[ticket.priority]}
                  />
                </DetailItem>
                <DetailItem label="Ouverte par">{ticket.opened_by_display ?? '—'}</DetailItem>
                <DetailItem label="Dernier échange">
                  {formatDateTime(ticket.last_message_at ?? ticket.created_at)}
                </DetailItem>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                {SUPPORT_STATUS_READONLY_NOTICE} {SUPPORT_ALWAYS_OPEN_NOTICE}
              </p>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Pièces jointes">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Pièces jointes</h2>
              </div>
            </div>
            <div
              className="ax-card__body"
              style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
            >
              {/* L'échec d'un téléchargement s'affiche DANS la carte
                  concernée, jamais en haut d'écran (correctif UX care S3). */}
              {downloadError && <ErrorAlert error={downloadError} />}

              {ticket.attachments.length === 0 ? (
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                  Aucune pièce jointe.
                </p>
              ) : (
                <ul className="ax-list ax-list--compact">
                  {ticket.attachments.map((attachment) => (
                    <li key={attachment.id} className="ax-list__row">
                      <span className="ax-list__content">
                        <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                          {supportAttachmentLabel(attachment.id)}
                        </span>
                        <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          Déposée le {formatDateTime(attachment.created_at)}
                        </span>
                      </span>
                      <span className="ax-list__trailing">
                        <button
                          type="button"
                          className="ax-btn ax-btn--ghost ax-btn--sm"
                          onClick={() => void download(attachment.id)}
                          disabled={downloadingId === attachment.id}
                          aria-label={`Télécharger ${supportAttachmentLabel(attachment.id)}`}
                        >
                          {DOWNLOAD_ICON}
                          <span className="ax-btn__label">
                            {downloadingId === attachment.id ? 'Téléchargement…' : 'Télécharger'}
                          </span>
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {!closed && (
                <AttachmentForm centerId={centerId} ticketId={ticket.id} onUploaded={state.reload} />
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default SupportTicketScreen;
