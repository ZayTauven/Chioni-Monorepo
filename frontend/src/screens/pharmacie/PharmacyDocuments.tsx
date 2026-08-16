'use client';
/*
 * Chioni — /pharmacie/pieces : les pièces justificatives de l'officine
 * (S9, ADR 0022 décision 5 — pipeline cloné une troisième fois).
 *
 * Même socle que le KYC d'un centre (S4) et que le justificatif de congé (S7),
 * lui-même dérivé de la dropzone Vireo (`forms/FileUpload`) adaptée en S3 pour
 * les documents patients. Rien de neuf, et c'est le but : les règles d'upload
 * durcies (ADR 0014) ne se réécrivent pas à chaque module.
 *
 * - photo JPEG / PNG / WebP **réelle** (le format est décodé côté serveur,
 *   l'extension du client est ignorée), 2 Mo, EXIF strippé — **le PDF est
 *   refusé**, une photo de licence est un JPEG ;
 * - **stockage privé** : aucune URL de fichier n'existe, jamais d'`<img src>`,
 *   les octets passent par `apiDownload` (Bearer + object URL révoqué) ;
 * - **l'archivage est définitif** : on corrige sans détruire, parce qu'une
 *   pièce qui a fondé une décision de validation doit rester vérifiable.
 *
 * Ces pièces sont **le chemin de sortie** d'une officine en attente ou
 * suspendue : c'est ce que Chioni lit pour la valider. L'écran le dit — sans
 * quoi « déposez vos pièces » resterait une consigne sans destination.
 */
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { usePharmacy } from '@/context/PharmacyContext';
import { ApiError } from '@/lib/api';
import {
  archivePharmacyDocument,
  downloadPharmacyDocument,
  listPharmacyDocuments,
  uploadPharmacyDocument,
} from '@/lib/endpoints/pharmacy';
import {
  ACTION_CANCEL,
  PHARMACY_DOCS_EMPTY_MESSAGE,
  PHARMACY_DOCS_EMPTY_TITLE,
  PHARMACY_DOCS_PRIVACY,
  PHARMACY_DOCS_SUBTITLE,
  PHARMACY_DOCS_TITLE,
  PHARMACY_DOC_ARCHIVE,
  PHARMACY_DOC_ARCHIVE_KEEP,
  PHARMACY_DOC_ARCHIVE_TITLE,
  PHARMACY_DOC_ARCHIVED,
  PHARMACY_DOC_DEPOSITED_FLASH,
  PHARMACY_DOC_DOWNLOAD,
  PHARMACY_DOC_DOWNLOADING,
  PHARMACY_DOC_DROPZONE,
  PHARMACY_DOC_DROPZONE_ACTIVE,
  PHARMACY_DOC_DROPZONE_REPLACE,
  PHARMACY_DOC_DROPZONE_SR,
  PHARMACY_DOC_TYPES,
  PHARMACY_DOC_TYPE_LABEL,
  PHARMACY_DOC_TYPE_LABELS,
  PHARMACY_DOC_UPLOAD,
  PHARMACY_DOC_UPLOAD_SUBMIT,
  UPLOAD_FORMAT_REFUSED,
  UPLOAD_IMAGE_HINT,
  formatBytes,
  pharmacyDocArchiveMessage,
  pharmacyDocDeposited,
  uploadThrottled,
  uploadTooLarge,
} from '@/lib/labels';
import type { PharmacyDocType, PharmacyDocument } from '@/lib/types';
import {
  Card,
  ConfirmModal,
  EmptyState,
  ErrorAlert,
  FieldError,
  SkeletonCards,
  Stack,
  SuccessAlert,
  toApiError,
  useAsync,
  useScopedState,
} from './shared';

/** Formats réellement acceptés par le backend (socle ADR 0014 tel quel). */
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

/** 429 du scope `uploads` (20/h) — le décodage Pillow a son propre budget. */
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

function UploadForm({
  onCancel,
  onUploaded,
}: {
  onCancel: () => void;
  onUploaded: () => void;
}) {
  const { pharmacyId } = usePharmacy();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileIssue, setFileIssue] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [docType, setDocType] = useState<PharmacyDocType>('licence_officine');
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
      await uploadPharmacyDocument(pharmacyId, { file, doc_type: docType });
      onUploaded();
    } catch (err) {
      setError(toUploadError(err));
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
    >
      {error && error.messages.length > 0 && <ErrorAlert error={error} />}

      {/* `is-dragover` va sur le WRAPPER : le design system cible
          `.ax-dropzone.is-dragover .ax-dropzone__area`. Posée sur l'aire
          elle-même, la règle ne s'applique jamais (correctif S4). */}
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
          aria-label={PHARMACY_DOC_DROPZONE_SR}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" />
            <path d="M9 15l3 -3l3 3" />
            <path d="M12 12l0 9" />
          </svg>
          <div style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>
            {file
              ? file.name
              : dragging
                ? PHARMACY_DOC_DROPZONE_ACTIVE
                : PHARMACY_DOC_DROPZONE}
          </div>
          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
            {file
              ? `${formatBytes(file.size)} · ${PHARMACY_DOC_DROPZONE_REPLACE}`
              : UPLOAD_IMAGE_HINT}
          </div>
          <input
            type="file"
            ref={inputRef}
            accept="image/jpeg,image/png,image/webp"
            /* `capture` volontairement ABSENT : sur un téléphone, l'appareil
               photo ET la galerie doivent rester possibles — la licence est
               souvent déjà photographiée. */
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
          <p
            className="ax-field__message ax-field__message--error"
            role="alert"
            style={{ marginTop: 'var(--ax-space-2)' }}
          >
            {fileIssue}
          </p>
        )}
        <FieldError error={error} field="file" />
      </div>

      <div className="ax-field">
        <label className="ax-label" htmlFor="pd-type">
          {PHARMACY_DOC_TYPE_LABEL}
        </label>
        <select
          id="pd-type"
          className="ax-select"
          value={docType}
          onChange={(e) => setDocType(e.target.value as PharmacyDocType)}
        >
          {PHARMACY_DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {PHARMACY_DOC_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <FieldError error={error} field="doc_type" />
      </div>

      <button
        type="submit"
        className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${saving ? ' is-loading' : ''}`}
        disabled={saving || !file}
        aria-busy={saving}
      >
        <span className="ax-btn__spinner" aria-hidden="true"></span>
        <span className="ax-btn__label">{PHARMACY_DOC_UPLOAD_SUBMIT}</span>
      </button>
      <button
        type="button"
        className="ax-btn ax-btn--ghost ax-btn--lg ax-btn--block"
        onClick={onCancel}
        disabled={saving}
      >
        {ACTION_CANCEL}
      </button>
    </form>
  );
}

export function PharmacyDocuments() {
  const { pharmacyId } = usePharmacy();
  const [uploading, setUploading] = useState(false);
  const [archiving, setArchiving] = useState<PharmacyDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<ApiError | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);
  /* Portée : l'officine active (guardian S9) — « pièce déposée » ne doit pas
     accompagner la bascule vers l'officine d'à côté, dont le dossier est
     peut-être vide. */
  const [flash, setFlash] = useScopedState<string>(String(pharmacyId));

  /* Un archivage est DÉFINITIF : une confirmation restée ouverte ne change
     pas de cible au changement d'officine, elle s'annule. */
  useEffect(() => {
    setUploading(false);
    setArchiving(null);
    setArchiveError(null);
    setDownloadError(null);
  }, [pharmacyId]);

  const documents = useAsync(() => listPharmacyDocuments(pharmacyId), [pharmacyId]);
  const rows = documents.data ?? [];

  const download = async (doc: PharmacyDocument) => {
    setDownloadingId(doc.id);
    setDownloadError(null);
    try {
      await downloadPharmacyDocument(pharmacyId, doc.id);
    } catch (err) {
      setDownloadError(toApiError(err));
    }
    setDownloadingId(null);
  };

  const archive = async () => {
    if (!archiving) return;
    setBusy(true);
    setArchiveError(null);
    try {
      await archivePharmacyDocument(pharmacyId, archiving.id);
      setArchiving(null);
      documents.reload();
    } catch (err) {
      setArchiveError(toApiError(err));
    }
    setBusy(false);
  };

  return (
    <Stack>
      {flash && <SuccessAlert message={flash} />}

      <Card title={PHARMACY_DOCS_TITLE} subtitle={PHARMACY_DOCS_SUBTITLE}>
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          {PHARMACY_DOCS_PRIVACY}
        </p>

        {downloadError && <ErrorAlert error={downloadError} />}

        {documents.loading ? (
          <SkeletonCards count={1} />
        ) : documents.error ? (
          <ErrorAlert error={documents.error} onRetry={documents.reload} />
        ) : rows.length === 0 ? (
          <EmptyState title={PHARMACY_DOCS_EMPTY_TITLE} message={PHARMACY_DOCS_EMPTY_MESSAGE} />
        ) : (
          <ul className="ax-list ax-list--compact">
            {rows.map((doc) => (
              <li key={doc.id} className="ax-list__row">
                <span className="ax-list__content">
                  <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                    {PHARMACY_DOC_TYPE_LABELS[doc.doc_type]}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--ax-text-xs)',
                      color: 'var(--ax-text-muted)',
                    }}
                  >
                    {pharmacyDocDeposited(doc.created_at)}
                  </span>
                </span>
                <span
                  className="ax-list__trailing"
                  style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center', flexWrap: 'wrap' }}
                >
                  {doc.archived_at && (
                    <span className="ax-badge ax-badge--soft ax-badge--neutral">
                      {PHARMACY_DOC_ARCHIVED}
                    </span>
                  )}
                  <button
                    type="button"
                    className="ax-btn ax-btn--ghost ax-btn--sm"
                    onClick={() => void download(doc)}
                    disabled={downloadingId === doc.id}
                    aria-label={`Télécharger ${PHARMACY_DOC_TYPE_LABELS[doc.doc_type]}`}
                  >
                    {DOWNLOAD_ICON}
                    <span className="ax-btn__label">
                      {downloadingId === doc.id
                        ? PHARMACY_DOC_DOWNLOADING
                        : PHARMACY_DOC_DOWNLOAD}
                    </span>
                  </button>
                  {!doc.archived_at && (
                    <button
                      type="button"
                      className="ax-btn ax-btn--ghost ax-btn--sm"
                      onClick={() => {
                        setArchiveError(null);
                        setArchiving(doc);
                      }}
                      aria-label={`Archiver ${PHARMACY_DOC_TYPE_LABELS[doc.doc_type]}`}
                    >
                      <span className="ax-btn__label">{PHARMACY_DOC_ARCHIVE}</span>
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {uploading ? (
          <UploadForm
            onCancel={() => setUploading(false)}
            onUploaded={() => {
              setUploading(false);
              setFlash(PHARMACY_DOC_DEPOSITED_FLASH);
              documents.reload();
            }}
          />
        ) : (
          <button
            type="button"
            className="ax-btn ax-btn--secondary ax-btn--lg ax-btn--block"
            onClick={() => setUploading(true)}
          >
            <span className="ax-btn__label">{PHARMACY_DOC_UPLOAD}</span>
          </button>
        )}
      </Card>

      <ConfirmModal
        open={archiving !== null}
        title={PHARMACY_DOC_ARCHIVE_TITLE}
        message={
          archiving ? pharmacyDocArchiveMessage(PHARMACY_DOC_TYPE_LABELS[archiving.doc_type]) : ''
        }
        confirmLabel={PHARMACY_DOC_ARCHIVE}
        cancelLabel={PHARMACY_DOC_ARCHIVE_KEEP}
        busy={busy}
        error={archiveError}
        onConfirm={() => void archive()}
        onClose={() => {
          if (busy) return;
          setArchiving(null);
          setArchiveError(null);
        }}
      />
    </Stack>
  );
}

export default PharmacyDocuments;
