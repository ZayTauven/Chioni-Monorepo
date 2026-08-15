'use client';
/*
 * Chioni — primitives partagées de l'hospitalisation (S6, ADR 0019).
 *
 * Elles vivent ici plutôt que dans `Inpatient.tsx` pour une raison de poids :
 * le détail d'un séjour a besoin de la modale d'attribution de lit, et
 * l'importer depuis l'écran de liste embarquerait tout le tableau d'occupation
 * dans son bundle — sur une connexion comorienne, ce n'est pas un détail.
 */
import { useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import { assignStayBed, listBeds } from '@/lib/endpoints/centers';
import {
  BED_ASSIGN_TITLE,
  BED_FREE_ONLY_NOTICE,
  BED_NONE_FREE,
  BED_TRANSFER_HINT,
  BED_TRANSFER_TITLE,
  STAY_NO_BED_LABEL,
  STAY_PRIORITY_LABELS,
  STAY_STATUS_LABELS,
} from '@/lib/labels';
import type { Bed, Stay, StayBedPosition, StayPriority, StayStatus } from '@/lib/types';
import {
  CardSkeleton,
  ErrorAlert,
  FieldError,
  Modal,
  STAY_PRIORITY_TONES,
  STAY_TONES,
  StatusBadge,
  toApiError,
  useAsync,
} from './shared';

/* ── badges ── */

export function StayStatusBadge({ status }: { status: StayStatus }) {
  return <StatusBadge tone={STAY_TONES[status]} label={STAY_STATUS_LABELS[status]} />;
}

/**
 * La priorité de triage. Une priorité « normale » est rendue en TEXTE et non
 * en pastille : si les trois niveaux portent le même poids visuel, le tableau
 * ne signale plus rien — et c'est précisément le cas critique qu'on cherche à
 * voir d'un coup d'œil.
 */
export function StayPriorityBadge({ priority }: { priority: StayPriority }) {
  if (priority === 'normale') {
    return (
      <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
        {STAY_PRIORITY_LABELS.normale}
      </span>
    );
  }
  return <StatusBadge tone={STAY_PRIORITY_TONES[priority]} label={STAY_PRIORITY_LABELS[priority]} />;
}

/** « Chambre 2 · Lit A », ou « Sans lit » — jamais un tiret muet. */
export function BedLabel({ bed }: { bed: StayBedPosition | null }) {
  if (bed === null) {
    return (
      <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
        {STAY_NO_BED_LABEL}
      </span>
    );
  }
  return (
    <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
      {bed.room_name} · {bed.name}
    </span>
  );
}

/* ── attribution / transfert de lit (rôles cliniques) ── */

/**
 * Le sélecteur ne liste que `?free=true` : les lits assignables À CET INSTANT.
 *
 * La contrainte partielle de la base reste la garantie — si quelqu'un prend le
 * lit entre l'ouverture de la modale et l'enregistrement, le refus arrive en
 * français et la liste se recharge toute seule (le lit disparaît). On dit donc
 * la règle AVANT le geste plutôt que de laisser un refus passer pour un bug.
 */
export function AssignBedModal({
  stay,
  onClose,
  onAssigned,
}: {
  stay: Stay;
  onClose: () => void;
  onAssigned: (fresh: Stay) => void;
}) {
  const { centerId } = useCenter();
  const [bedId, setBedId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const beds = useAsync(() => listBeds(centerId, { free: true }), [centerId]);
  const transfer = stay.bed !== null;
  const free: Bed[] = beds.data ?? [];

  const submit = async () => {
    if (bedId === '') return;
    setSaving(true);
    setError(null);
    try {
      onAssigned(await assignStayBed(centerId, stay.id, bedId));
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
      // Le lit vient peut-être d'être pris : on repart d'une liste juste.
      setBedId('');
      beds.reload();
    }
  };

  return (
    <Modal
      title={transfer ? BED_TRANSFER_TITLE : BED_ASSIGN_TITLE}
      onClose={onClose}
      busy={saving}
      width={520}
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
            className="ax-btn ax-btn--primary"
            onClick={() => void submit()}
            disabled={saving || bedId === ''}
          >
            <span className="ax-btn__label">
              {saving ? 'Enregistrement…' : transfer ? 'Transférer' : 'Attribuer le lit'}
            </span>
          </button>
        </>
      }
    >
      {error && error.messages.length > 0 && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
        <b>{stay.patient_name}</b>
        {transfer && stay.bed !== null ? (
          <>
            {' '}
            — actuellement en {stay.bed.room_name} · {stay.bed.name}.
          </>
        ) : (
          <> — aucun lit attribué pour l’instant.</>
        )}
      </p>
      {transfer && (
        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
          {BED_TRANSFER_HINT}
        </p>
      )}

      {beds.loading ? (
        <CardSkeleton lines={2} />
      ) : beds.error ? (
        <ErrorAlert error={beds.error} onRetry={beds.reload} />
      ) : free.length === 0 ? (
        <div className="ax-alert ax-alert--info" role="status">
          <div className="ax-alert__content">
            <p className="ax-alert__message">{BED_NONE_FREE}</p>
          </div>
        </div>
      ) : (
        <div className="ax-field">
          <label className="ax-label" htmlFor="bed-picker">
            Lit libre <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <select
            id="bed-picker"
            className="ax-select"
            value={bedId === '' ? '' : String(bedId)}
            onChange={(e) => setBedId(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))}
          >
            <option value="">Choisir un lit…</option>
            {free.map((bed) => (
              <option key={bed.id} value={bed.id}>
                {bed.room_name} · {bed.name}
              </option>
            ))}
          </select>
          <span className="ax-field__message">{BED_FREE_ONLY_NOTICE}</span>
          <FieldError error={error} field="bed" />
        </div>
      )}
    </Modal>
  );
}
