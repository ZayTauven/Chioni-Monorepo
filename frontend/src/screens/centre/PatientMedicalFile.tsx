'use client';
/*
 * Chioni — carte « Fiche médicale » de la fiche patient (S3, ADR 0016 §3).
 *
 * Sphère CLINIQUE : le groupe sanguin est une donnée de santé (RGPD art. 9),
 * jamais dans la fenêtre administrative. Cette carte n'est montée QUE pour
 * les rôles cliniques (comme le bloc finances du dashboard) — l'endpoint
 * répond 403 aux autres, on ne l'appelle même pas. Forme vide constante
 * avant la première écriture (`updated_at: null`) : jamais de 404 à rendre.
 */
import { useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  getPatientMedicalFile,
  updatePatientMedicalFile,
} from '@/lib/endpoints/centers';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, formatDateTime } from '@/lib/labels';
import type { BloodGroup, PatientMedicalFile } from '@/lib/types';
import {
  CardSkeleton,
  DetailItem,
  ErrorAlert,
  FieldError,
  IconEdit,
  toApiError,
  useAsync,
} from './shared';

function MedicalFileForm({
  file,
  patientId,
  onCancel,
  onSaved,
}: {
  file: PatientMedicalFile;
  patientId: number;
  onCancel: () => void;
  onSaved: (fresh: PatientMedicalFile) => void;
}) {
  const { centerId } = useCenter();
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(file.blood_group);
  const [notes, setNotes] = useState(file.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await updatePatientMedicalFile(centerId, patientId, {
        blood_group: bloodGroup,
        notes: notes.trim(),
      });
      onSaved(fresh);
    } catch (err) {
      setError(toApiError(err));
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
      <div className="ax-field">
        <label className="ax-label" htmlFor="mf-blood">Groupe sanguin</label>
        <select
          id="mf-blood"
          className="ax-select"
          value={bloodGroup}
          onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
        >
          <option value="">{BLOOD_GROUP_LABELS['']}</option>
          {BLOOD_GROUPS.map((bg) => (
            <option key={bg} value={bg}>
              {BLOOD_GROUP_LABELS[bg]}
            </option>
          ))}
        </select>
        <FieldError error={error} field="blood_group" />
      </div>
      <div className="ax-field">
        <label className="ax-label" htmlFor="mf-notes">Notes cliniques</label>
        <textarea
          id="mf-notes"
          className="ax-textarea"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <FieldError error={error} field="notes" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--ax-space-2)' }}>
        <button type="button" className="ax-btn ax-btn--ghost" onClick={onCancel} disabled={saving}>
          Annuler
        </button>
        <button type="submit" className="ax-btn ax-btn--primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

/** À ne monter QUE derrière une garde de rôle clinique. */
export function MedicalFileCard({ patientId }: { patientId: number }) {
  const { centerId } = useCenter();
  const [editing, setEditing] = useState(false);
  const [patched, setPatched] = useState<PatientMedicalFile | null>(null);

  const fileState = useAsync(
    () => getPatientMedicalFile(centerId, patientId),
    [centerId, patientId],
  );
  const file = patched ?? fileState.data;

  return (
    <section className="ax-card ax-col--4" role="region" aria-label="Fiche médicale">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Fiche médicale</h2>
          <p className="ax-card__subtitle">Réservée aux rôles soignants</p>
        </div>
        {!editing && file && (
          <button
            type="button"
            className="ax-btn ax-btn--ghost ax-btn--sm"
            onClick={() => setEditing(true)}
          >
            <IconEdit />
            <span className="ax-btn__label">Modifier</span>
          </button>
        )}
      </div>
      <div
        className="ax-card__body"
        style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {fileState.loading ? (
          <CardSkeleton lines={3} />
        ) : fileState.error || !file ? (
          <ErrorAlert error={fileState.error ?? toApiError(null)} onRetry={fileState.reload} />
        ) : editing ? (
          <MedicalFileForm
            file={file}
            patientId={patientId}
            onCancel={() => setEditing(false)}
            onSaved={(fresh) => {
              setPatched(fresh);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <DetailItem label="Groupe sanguin">
              {file.blood_group ? (
                <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>
                  {BLOOD_GROUP_LABELS[file.blood_group]}
                </b>
              ) : (
                BLOOD_GROUP_LABELS['']
              )}
            </DetailItem>
            <DetailItem label="Notes cliniques">
              {file.notes ? (
                <span style={{ whiteSpace: 'pre-wrap' }}>{file.notes}</span>
              ) : (
                '—'
              )}
            </DetailItem>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
              {file.updated_at
                ? `Mise à jour le ${formatDateTime(file.updated_at)}`
                : 'Pas encore renseignée.'}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
