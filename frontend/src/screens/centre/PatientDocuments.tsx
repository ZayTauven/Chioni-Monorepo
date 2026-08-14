'use client';
/*
 * Chioni — carte « Documents » de la fiche patient (S3, ADR 0016 §5).
 *
 * Sphère CLINIQUE, bornée au centre producteur : la carte n'est montée QUE
 * pour les rôles cliniques. Base Vireo : la dropzone de forms/FileUpload
 * (classes ax-dropzone) et son glyphe image, adaptés à la réalité comorienne
 * — la photo de document (JPEG/PNG/WebP, 2 Mo). Le PDF est différé.
 *
 * Diffusion privée (le point de sécurité n° 1 du sprint) : JAMAIS d'URL de
 * fichier — ni <img src>, ni lien statique. Les octets passent par
 * l'endpoint authentifié via apiDownload (Bearer + object URL révoqué).
 * Archivage = correction sans destruction : le patient ne voit plus le
 * document, le staff du centre garde la ligne ET le téléchargement.
 */
import { useRef, useState, type DragEvent } from 'react';
import { useCenter } from '@/context/CenterContext';
import { ApiError } from '@/lib/api';
import {
  archivePatientDocument,
  downloadPatientDocument,
  listPatientDocuments,
  uploadPatientDocument,
} from '@/lib/endpoints/centers';
import { DOC_TYPE_LABELS, formatDate, formatWait } from '@/lib/labels';
import type { PatientDocumentStaff, PatientDocumentType } from '@/lib/types';
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

/** Formats réellement acceptés par le backend (ADR 0014 réutilisé tel quel). */
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

/** 429 du scope `uploads` (20/h, partagé avatar/logo) : message en français. */
function toUploadError(err: unknown): ApiError {
  const e = toApiError(err);
  if (e.status === 429) {
    return new ApiError(429, [
      e.retryAfterSeconds
        ? `Trop d'envois rapprochés. Réessayez dans ${formatWait(e.retryAfterSeconds)}.`
        : "Trop d'envois rapprochés. Patientez un moment avant de réessayer.",
    ]);
  }
  return e;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

const DOWNLOAD_ICON = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
    <path d="M7 11l5 5l5 -5" />
    <path d="M12 4l0 12" />
  </svg>
);

/* ── upload modal (dropzone Vireo compactée) ── */

function UploadDocumentModal({
  patientId,
  onClose,
  onUploaded,
}: {
  patientId: number;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { centerId } = useCenter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileIssue, setFileIssue] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<PatientDocumentType>('resultat_biologie');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const pick = (picked: File | null) => {
    setError(null);
    if (!picked) return;
    if (!ACCEPTED_MIME.includes(picked.type)) {
      setFile(null);
      setFileIssue('Formats acceptés : photo JPEG, PNG ou WebP. Le PDF n’est pas encore pris en charge.');
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setFileIssue(`Photo trop lourde (${formatBytes(picked.size)}). Le maximum est de 2 Mo.`);
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
      await uploadPatientDocument(centerId, patientId, {
        file,
        doc_type: docType,
        title: title.trim(),
      });
      onUploaded();
    } catch (err) {
      setError(toUploadError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Ajouter un document"
      onClose={onClose}
      width={560}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="doc-upload-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || !file || !title.trim()}
          >
            {saving ? 'Envoi…' : 'Ajouter au dossier'}
          </button>
        </>
      }
    >
      <form
        id="doc-upload-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <div className="ax-dropzone">
          <div
            className={`ax-dropzone__area${dragging ? ' is-dragover' : ''}`}
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
            aria-label="Choisir la photo du document"
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
                  ? 'Déposez la photo ici'
                  : 'Photo du document — cliquez ou déposez ici'}
            </div>
            <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
              {file ? `${formatBytes(file.size)} · cliquez pour remplacer` : 'JPEG, PNG ou WebP · 2 Mo maximum'}
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
          <label className="ax-label" htmlFor="doc-title">
            Titre <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="doc-title"
            type="text"
            className={`ax-input${error?.fieldErrors.title ? ' is-invalid' : ''}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex. Bilan sanguin du 12 août"
            required
          />
          <FieldError error={error} field="title" />
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="doc-type">Type de document</label>
          <select
            id="doc-type"
            className="ax-select"
            value={docType}
            onChange={(e) => setDocType(e.target.value as PatientDocumentType)}
          >
            {(Object.keys(DOC_TYPE_LABELS) as PatientDocumentType[]).map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <FieldError error={error} field="doc_type" />
        </div>
      </form>
    </Modal>
  );
}

/* ── archive confirmation ── */

function ArchiveDocumentModal({
  doc,
  onClose,
  onArchived,
}: {
  doc: PatientDocumentStaff;
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
      await archivePatientDocument(centerId, doc.patient, doc.id);
      onArchived();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Archiver ce document ?"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving} data-autofocus="">
            Garder le document
          </button>
          <button type="button" className="ax-btn ax-btn--danger" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Archivage…' : 'Archiver'}
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
        <b>{doc.title}</b> ne sera plus visible du patient. Votre équipe garde la trace et le
        fichier pour vérification. Ce geste est définitif — en cas d&apos;erreur de dossier,
        ajoutez ensuite le bon document.
      </p>
    </Modal>
  );
}

/* ── card ── */

/** À ne monter QUE derrière une garde de rôle clinique. */
export function DocumentsCard({ patientId }: { patientId: number }) {
  const { centerId } = useCenter();
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [archiving, setArchiving] = useState<PatientDocumentStaff | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);

  const documents = useAsync(
    () => listPatientDocuments(centerId, patientId, page),
    [centerId, patientId, page],
  );
  const rows = documents.data?.results ?? [];

  const download = async (doc: PatientDocumentStaff) => {
    setDownloadingId(doc.id);
    setDownloadError(null);
    try {
      await downloadPatientDocument(centerId, patientId, doc.id);
    } catch (err) {
      setDownloadError(toApiError(err));
    }
    setDownloadingId(null);
  };

  return (
    <section className="ax-card ax-col--8" role="region" aria-label="Documents du dossier">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Documents</h2>
          <p className="ax-card__subtitle">
            Photos de résultats et comptes rendus ajoutées par ce centre
          </p>
        </div>
        <button
          type="button"
          className="ax-btn ax-btn--secondary ax-btn--sm"
          onClick={() => setUploadOpen(true)}
        >
          <IconPlus />
          <span className="ax-btn__label">Ajouter un document</span>
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
            title="Aucun document"
            message="Ajoutez la photo d'un résultat d'analyses, d'une imagerie ou d'un compte rendu pour la garder au dossier."
          />
        ) : (
          <>
            <ul className="ax-list ax-list--compact">
              {rows.map((doc) => (
                <li key={doc.id} className="ax-list__row">
                  <span
                    className="ax-avatar ax-avatar--sm ax-avatar--squircle ax-list__leading"
                    style={{
                      background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)',
                      color: 'var(--ax-viz-cyan)',
                      flex: '0 0 auto',
                    }}
                    aria-hidden="true"
                  >
                    <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M15 8h.01" />
                      <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" />
                      <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
                      <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
                    </svg>
                  </span>
                  <span className="ax-list__content">
                    <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                      {doc.title}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                      {DOC_TYPE_LABELS[doc.doc_type]} · {formatDate(doc.created_at)}
                      {doc.archived_at ? ` · Archivé le ${formatDate(doc.archived_at)}` : ''}
                    </span>
                  </span>
                  <span
                    className="ax-list__trailing"
                    style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}
                  >
                    {doc.archived_at && <StatusBadge tone="neutral" label="Archivé" />}
                    <button
                      type="button"
                      className="ax-btn ax-btn--ghost ax-btn--sm"
                      onClick={() => void download(doc)}
                      disabled={downloadingId === doc.id}
                      aria-label={`Télécharger ${doc.title}`}
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
                        aria-label={`Archiver ${doc.title}`}
                      >
                        <span className="ax-btn__label">Archiver</span>
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {documents.data && (
              <Pagination count={documents.data.count} page={page} onPage={setPage} />
            )}
          </>
        )}
      </div>

      {uploadOpen && (
        <UploadDocumentModal
          patientId={patientId}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            setPage(1);
            documents.reload();
          }}
        />
      )}
      {archiving && (
        <ArchiveDocumentModal
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
