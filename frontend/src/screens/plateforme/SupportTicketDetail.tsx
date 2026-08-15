'use client';
/*
 * Chioni — /plateforme/tickets/[id] : répondre à un centre (S5 lot 3).
 *
 * **L'UNIQUE exception d'écriture du back-office pour un `support`.** Partout
 * ailleurs « `support` lit, `admin` seul écrit » — créer un centre, bouger un
 * KYC, ouvrir un contrat, geler une administration, enregistrer un règlement,
 * exécuter un effacement, gérer l'équipe. Ce sont des décisions sur le TENANT
 * et sur l'ARGENT. Répondre à un ticket et le faire avancer n'est ni l'un ni
 * l'autre : c'est littéralement le métier du rôle. L'exception est ÉTROITE
 * (poster un message, changer un statut) — les deux gestes de cet écran sont
 * donc montés pour les DEUX rôles, sans `canWrite`.
 *
 * Le fil est distinct visuellement : le centre à gauche, Chioni à droite.
 * Aucun humain n'est nommé de ce côté-ci (ni l'auteur du centre, ni l'agent
 * Chioni) : `author` est un id de compte, conformément au contrat du
 * back-office.
 *
 * `ferme` est DÉFINITIF : la transition est présentée comme telle, et une fois
 * posée le fil passe en lecture seule.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import { ApiError } from '@/lib/api';
import {
  downloadPlatformTicketAttachment,
  getPlatformTicket,
  postPlatformTicketMessage,
  setPlatformTicketStatus,
} from '@/lib/endpoints/platform';
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_CHIONI_AUTHOR,
  SUPPORT_CLOSED_NOTICE,
  SUPPORT_CLOSE_WARNING,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_SIDE_LABELS,
  SUPPORT_STATUS_CHANGE_NOTICE,
  SUPPORT_STATUS_LABELS,
  formatDateTime,
  operatorAccountLabel,
  supportAttachmentLabel,
} from '@/lib/labels';
import type {
  PlatformSupportMessage,
  PlatformSupportTicketDetail as TicketDetail,
  SupportTicketStatus,
} from '@/lib/types';
import {
  CardSkeleton,
  DetailItem,
  ErrorAlert,
  FieldError,
  Modal,
  Ref,
  SUPPORT_PRIORITY_TONES,
  SUPPORT_TONES,
  StatusBadge,
  toApiError,
  useAsync,
} from './shared';

/**
 * La machine à états du backend, recopiée pour ne proposer que des transitions
 * légales. `ferme` est final — rouvrir un dossier clos, c'est en ouvrir un
 * nouveau, pour que le fil d'un incident reste le fil de CET incident.
 */
const TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  ouvert: ['en_cours', 'resolu', 'ferme'],
  en_cours: ['ouvert', 'resolu', 'ferme'],
  resolu: ['en_cours', 'ferme'],
  ferme: [],
};

const DOWNLOAD_ICON = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
    <path d="M7 11l5 5l5 -5" />
    <path d="M12 4l0 12" />
  </svg>
);

function MessageBubble({ message }: { message: PlatformSupportMessage }) {
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
      <div
        style={{
          maxWidth: 'min(560px, 92%)',
          padding: 'var(--ax-space-3) var(--ax-space-4)',
          borderRadius: 'var(--ax-radius-md)',
          background: fromCenter ? 'var(--ax-surface-subtle)' : 'var(--ax-accent-wash)',
          border: '1px solid var(--ax-border)',
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
        <b style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>
          {fromCenter ? SUPPORT_SIDE_LABELS.centre : SUPPORT_CHIONI_AUTHOR}
        </b>
        {' · '}
        {formatDateTime(message.created_at)}
        {' · '}
        <Ref>{operatorAccountLabel(message.author)}</Ref>
      </span>
    </li>
  );
}

/* ── changement de statut ── */

function StatusModal({
  ticket,
  target,
  onClose,
  onDone,
}: {
  ticket: TicketDetail;
  target: SupportTicketStatus;
  onClose: () => void;
  onDone: (fresh: TicketDetail) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const closing = target === 'ferme';

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await setPlatformTicketStatus(ticket.id, target);
      onDone(fresh);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Passer ce ticket en « ${SUPPORT_STATUS_LABELS[target]} » ?`}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
            data-autofocus=""
          >
            Annuler
          </button>
          <button
            type="button"
            className={`ax-btn ${closing ? 'ax-btn--danger' : 'ax-btn--primary'}`}
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : SUPPORT_STATUS_LABELS[target]}
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
        {closing ? SUPPORT_CLOSE_WARNING : SUPPORT_STATUS_CHANGE_NOTICE}
      </p>
    </Modal>
  );
}

/* ── écran ── */

export function PlatformSupportTicketDetail({ ticketId }: { ticketId: number }) {
  const state = useAsync(() => getPlatformTicket(ticketId), [ticketId]);
  const [patched, setPatched] = useState<TicketDetail | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ApiError | null>(null);
  const [target, setTarget] = useState<SupportTicketStatus | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);

  /* Le ticket renvoyé par un changement de statut prime sur le fetch, et il
     ne décrit QUE l'id courant : un fil de discussion d'un AUTRE centre resté
     à l'écran serait la pire des confusions dans ce back-office. Aucun lien
     ticket→ticket n'existe : garde de principe. */
  useEffect(() => setPatched(null), [ticketId]);
  const ticket = patched ?? state.data;

  const send = async () => {
    if (!ticket || body.trim().length === 0) return;
    setSending(true);
    setSendError(null);
    try {
      await postPlatformTicketMessage(ticket.id, body.trim());
      setBody('');
      setPatched(null);
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
      await downloadPlatformTicketAttachment(ticket.id, attachmentId);
    } catch (err) {
      setDownloadError(toApiError(err));
    }
    setDownloadingId(null);
  };

  if (!ticket) {
    return (
      <>
        <PlatformPageHead
          title="Ticket"
          trail={[{ label: 'Support', href: '/plateforme/tickets' }, { label: 'Ticket' }]}
        />
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
      <PlatformPageHead
        title={ticket.subject}
        subtitle={`${ticket.center_name} · ${SUPPORT_CATEGORY_LABELS[ticket.category]}`}
        trail={[{ label: 'Support', href: '/plateforme/tickets' }, { label: ticket.subject }]}
      />

      <div className="ax-dash-grid">
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
                Ce ticket a été ouvert sans message. Demandez au centre ce qu&apos;il se passe.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                {ticket.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </ul>
            )}

            {closed ? (
              <div className="ax-alert ax-alert--info" role="status">
                <div className="ax-alert__content">
                  <p className="ax-alert__message">{SUPPORT_CLOSED_NOTICE}</p>
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
                <div className="ax-field">
                  <label className="ax-label" htmlFor="platform-reply">
                    Votre réponse au centre
                  </label>
                  <textarea
                    id="platform-reply"
                    className={`ax-input${sendError?.fieldErrors.body ? ' is-invalid' : ''}`}
                    rows={4}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={5000}
                    aria-describedby="platform-reply-help"
                  />
                  {/* Le centre lit « Chioni », jamais un agent : le dire évite
                      qu'on signe un message d'un prénom. */}
                  <p id="platform-reply-help" className="ax-field__message">
                    Le centre lira « {SUPPORT_CHIONI_AUTHOR} » : votre identité ne lui est jamais
                    transmise. Poster ne change pas l&apos;état du ticket.
                  </p>
                  <FieldError error={sendError} field="body" />
                </div>
                <div>
                  <button
                    type="submit"
                    className="ax-btn ax-btn--primary"
                    disabled={sending || body.trim().length === 0}
                  >
                    <span className="ax-btn__label">{sending ? 'Envoi…' : 'Répondre'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        <aside
          className="ax-col--4"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0, alignSelf: 'start' }}
        >
          <section className="ax-card" role="region" aria-label="Le ticket">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Le ticket</h2>
              </div>
            </div>
            <div
              className="ax-card__body"
              style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--ax-space-4)' }}>
                <DetailItem label="Centre">
                  <Link href={`/plateforme/centres/${ticket.center}`} className="ax-link">
                    {ticket.center_name}
                  </Link>
                </DetailItem>
                <DetailItem label="Sujet">{SUPPORT_CATEGORY_LABELS[ticket.category]}</DetailItem>
                <DetailItem label="Urgence déclarée">
                  <StatusBadge
                    tone={SUPPORT_PRIORITY_TONES[ticket.priority]}
                    label={SUPPORT_PRIORITY_LABELS[ticket.priority]}
                  />
                </DetailItem>
                <DetailItem label="Ouvert le">{formatDateTime(ticket.created_at)}</DetailItem>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Ref>ticket #{ticket.id}</Ref>
                <Ref>centre #{ticket.center}</Ref>
                <Ref>ouvert par le {operatorAccountLabel(ticket.opened_by).toLowerCase()}</Ref>
              </div>
              {/* Le tri est le geste de Chioni — et l'exception d'écriture du
                  `support` : ces boutons sont montés pour les DEUX rôles. */}
              {TRANSITIONS[ticket.status].length > 0 && (
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                  {TRANSITIONS[ticket.status].map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`ax-btn ${t === 'ferme' ? 'ax-btn--ghost' : 'ax-btn--secondary'} ax-btn--sm`}
                      onClick={() => setTarget(t)}
                    >
                      <span className="ax-btn__label">{SUPPORT_STATUS_LABELS[t]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Pièces jointes">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Pièces jointes</h2>
                <p className="ax-card__subtitle">Déposées par le centre — images seulement.</p>
              </div>
            </div>
            <div
              className="ax-card__body"
              style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}
            >
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
            </div>
          </section>
        </aside>
      </div>

      {target && (
        <StatusModal
          ticket={ticket}
          target={target}
          onClose={() => setTarget(null)}
          onDone={(fresh) => {
            setPatched(fresh);
            setTarget(null);
          }}
        />
      )}
    </>
  );
}

export default PlatformSupportTicketDetail;
