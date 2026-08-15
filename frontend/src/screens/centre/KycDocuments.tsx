'use client';
/*
 * Chioni — carte « Pièces justificatives » de /centre/parametres (S4, ADR 0017).
 *
 * DIRECTEUR SEUL — la carte n'est jamais MONTÉE pour un autre rôle (fetch
 * compris) : une pièce d'identité de directeur n'est pas une donnée
 * d'exploitation, la secrétaire et le caissier reçoivent d'ailleurs un 403.
 *
 * Base réutilisée : la dropzone Vireo (`ax-dropzone` de forms/FileUpload)
 * adaptée en S3 dans `PatientDocuments.tsx` — même socle d'uploads (ADR 0014 :
 * photo JPEG/PNG/WebP réelle, 2 Mo, EXIF strippé, PDF refusé), même diffusion
 * PRIVÉE : jamais d'URL de fichier, jamais d'<img src>, les octets passent
 * par `apiDownload` (Bearer + object URL révoqué).
 *
 * Archivage = correction sans destruction, et DÉFINITIF : la pièce qui a
 * justifié une décision KYC doit rester vérifiable.
 */
import { useRef, useState, type DragEvent } from 'react';
import { useCenter } from '@/context/CenterContext';
import { ApiError } from '@/lib/api';
import {
  archiveKycDocument,
  downloadKycDocument,
  listKycDocuments,
  uploadKycDocument,
} from '@/lib/endpoints/centers';
import {
  KYC_DOC_TYPE_LABELS,
  UPLOAD_FORMAT_REFUSED,
  UPLOAD_IMAGE_HINT,
  formatBytes,
  formatDate,
  uploadThrottled,
  uploadTooLarge,
} from '@/lib/labels';
import type { KycDocType, KycDocument } from '@/lib/types';
import {
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconPlus,
  Modal,
  Pagination,
  StatusBadge,
  toApiError,
  useAsync,
} from './shared';

/** Formats réellement acceptés par le backend (socle ADR 0014 tel quel). */
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

/** 429 du scope `uploads` (20/h, partagé avatar/logo/documents patients). */
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

/* ── dépôt d'une pièce ── */

function UploadKycModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const { centerId } = useCenter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileIssue, setFileIssue] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [docType, setDocType] = useState<KycDocType>('registre_commerce');
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

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0] ?? null);
  };

  const submit = async () => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      await uploadKycDocument(centerId, { file, doc_type: docType });
      onUploaded();
    } catch (err) {
      setError(toUploadError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Déposer une pièce justificative"
      onClose={onClose}
      width={560}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" form="kyc-upload-form" className="ax-btn ax-btn--primary" disabled={saving || !file}>
            {saving ? 'Envoi…' : 'Déposer la pièce'}
          </button>
        </>
      }
    >
      <form
        id="kyc-upload-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
          Ces pièces sont lues par l&apos;équipe Chioni pour vérifier votre centre. Elles sont
          stockées de façon privée&nbsp;: personne d&apos;autre dans votre centre n&apos;y a accès.
        </p>

        {/* `is-dragover` va sur le WRAPPER : le design system cible
            `.ax-dropzone.is-dragover .ax-dropzone__area`. Posée sur l'aire
            elle-même, la règle ne s'applique jamais et le survol reste muet. */}
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
            aria-label="Choisir la photo de la pièce"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" />
              <path d="M9 15l3 -3l3 3" />
              <path d="M12 12l0 9" />
            </svg>
            <div style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>
              {file ? file.name : dragging ? 'Déposez la photo ici' : 'Photo de la pièce — cliquez ou déposez ici'}
            </div>
            <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
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
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="kyc-doc-type">Type de pièce</label>
          <select
            id="kyc-doc-type"
            className="ax-select"
            value={docType}
            onChange={(e) => setDocType(e.target.value as KycDocType)}
          >
            {(Object.keys(KYC_DOC_TYPE_LABELS) as KycDocType[]).map((t) => (
              <option key={t} value={t}>
                {KYC_DOC_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <FieldError error={error} field="doc_type" />
        </div>
      </form>
    </Modal>
  );
}

/* ── archivage (définitif) ── */

function ArchiveKycModal({
  doc,
  onClose,
  onArchived,
}: {
  doc: KycDocument;
  onClose: () => void;
  onArchived: () => void;
}) {
  const { centerId } = useCenter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await archiveKycDocument(centerId, doc.id);
      onArchived();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Archiver cette pièce ?"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving} data-autofocus="">
            Garder la pièce
          </button>
          <button type="button" className="ax-btn ax-btn--danger" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Archivage…' : 'Archiver'}
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
        <b>{KYC_DOC_TYPE_LABELS[doc.doc_type]}</b> sera signalée comme archivée. La pièce n&apos;est
        pas supprimée&nbsp;: une décision de vérification doit rester vérifiable. Ce geste est
        définitif — en cas d&apos;erreur, déposez ensuite la bonne pièce.
      </p>
    </Modal>
  );
}

/* ── carte ── */

/** À ne monter QUE derrière une garde de rôle « directeur ». */
export function KycDocumentsCard() {
  const { centerId } = useCenter();
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [archiving, setArchiving] = useState<KycDocument | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);

  const documents = useAsync(() => listKycDocuments(centerId, page), [centerId, page]);
  const rows = documents.data?.results ?? [];

  const download = async (doc: KycDocument) => {
    setDownloadingId(doc.id);
    setDownloadError(null);
    try {
      await downloadKycDocument(centerId, doc.id);
    } catch (err) {
      setDownloadError(toApiError(err));
    }
    setDownloadingId(null);
  };

  return (
    <section className="ax-card" role="region" aria-label="Pièces justificatives du centre">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Pièces justificatives</h2>
          <p className="ax-card__subtitle">
            Vos documents d&apos;établissement, lus par l&apos;équipe Chioni pour la vérification.
          </p>
        </div>
        <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setUploadOpen(true)}>
          <IconPlus />
          <span className="ax-btn__label">Déposer une pièce</span>
        </button>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        {downloadError && <ErrorAlert error={downloadError} />}
        {documents.loading ? (
          <CardSkeleton lines={3} />
        ) : documents.error ? (
          <ErrorAlert error={documents.error} onRetry={documents.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Aucune pièce déposée"
            message="Photographiez votre registre du commerce et votre licence sanitaire pour permettre à l'équipe Chioni de vérifier votre centre."
            action={
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setUploadOpen(true)}>
                <IconPlus />
                <span className="ax-btn__label">Déposer une pièce</span>
              </button>
            }
          />
        ) : (
          <>
            <ul className="ax-list ax-list--compact">
              {rows.map((doc) => (
                <li key={doc.id} className="ax-list__row">
                  <span className="ax-list__content">
                    <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                      {KYC_DOC_TYPE_LABELS[doc.doc_type]}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                      Déposée le {formatDate(doc.created_at)}
                      {doc.archived_at ? ` · archivée le ${formatDate(doc.archived_at)}` : ''}
                    </span>
                  </span>
                  <span className="ax-list__trailing" style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}>
                    {doc.archived_at && <StatusBadge tone="neutral" label="Archivée" />}
                    <button
                      type="button"
                      className="ax-btn ax-btn--ghost ax-btn--sm"
                      onClick={() => void download(doc)}
                      disabled={downloadingId === doc.id}
                      aria-label={`Télécharger ${KYC_DOC_TYPE_LABELS[doc.doc_type]}`}
                    >
                      {DOWNLOAD_ICON}
                      <span className="ax-btn__label">
                        {downloadingId === doc.id ? 'Téléchargement…' : 'Télécharger'}
                      </span>
                    </button>
                    {!doc.archived_at && (
                      <button
                        type="button"
                        className="ax-btn ax-btn--ghost ax-btn--sm"
                        onClick={() => setArchiving(doc)}
                        aria-label={`Archiver ${KYC_DOC_TYPE_LABELS[doc.doc_type]}`}
                      >
                        <span className="ax-btn__label">Archiver</span>
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {documents.data && <Pagination count={documents.data.count} page={page} onPage={setPage} />}
          </>
        )}
      </div>

      {uploadOpen && (
        <UploadKycModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            setPage(1);
            documents.reload();
          }}
        />
      )}
      {archiving && (
        <ArchiveKycModal
          doc={archiving}
          onClose={() => setArchiving(null)}
          onArchived={() => {
            setArchiving(null);
            documents.reload();
          }}
        />
      )}
    </section>
  );
}

export default KycDocumentsCard;
