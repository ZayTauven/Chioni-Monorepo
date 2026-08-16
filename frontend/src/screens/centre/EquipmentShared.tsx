'use client';
/*
 * Chioni — briques partagées des deux écrans « Équipements » (S8, ADR 0021).
 *
 * Trois composants, et la frontière du module tient dans leurs noms :
 *
 * - `EquipmentFormModal` — DÉCLARER / CORRIGER une fiche. **Directeur seul**,
 *   et les deux appelants le gardent avant de la monter.
 * - `EquipmentReportModal` — SIGNALER une panne. **Tout membre actif**, jamais
 *   gelé. C'est le geste central du module ; sa modale porte, en tête, la
 *   phrase qui empêche la confusion du sprint : *un signalement ne change pas
 *   l'état de l'appareil*.
 * - `EquipmentReportFeed` — le fil des constats.
 *
 * ─── L'audience du fil, et pourquoi il n'y a pas d'« Anonyme » ─────────────
 *
 * Le backend rend deux payloads pour la même ligne : tout le staff reçoit le
 * constat et sa date, le directeur reçoit **en plus** son auteur. Le fil REND
 * donc ce qui arrive et **ne réserve aucun emplacement** pour un auteur qu'il
 * ne recevra pas — pas de ligne vide, pas de tiret, et surtout **jamais
 * « Anonyme »** : l'absence d'auteur n'est pas une donnée manquante à combler,
 * c'est une décision de produit (nommer le signaleur devant toute l'équipe
 * refroidirait la prochaine panne). Deux verrous, patron `Inpatient.tsx` : la
 * casquette du centre ACTIF **et** la présence réelle du champ dans le
 * payload — aucune régression de sérialiseur ne suffit à elle seule à ouvrir
 * le nom au reste de l'équipe.
 */
import { useState } from 'react';
import type { ApiError } from '@/lib/api';
import { useCenter } from '@/context/CenterContext';
import {
  createEquipment,
  reportEquipmentIssue,
  updateEquipment,
} from '@/lib/endpoints/equipment';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABEL,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_COMMISSIONED_HINT,
  EQUIPMENT_COMMISSIONED_LABEL,
  EQUIPMENT_CREATE_TITLE,
  EQUIPMENT_EDIT_TITLE,
  EQUIPMENT_LOCATION_HINT,
  EQUIPMENT_LOCATION_LABEL,
  EQUIPMENT_NAME_HINT,
  EQUIPMENT_NAME_LABEL,
  EQUIPMENT_NOTES_HINT,
  EQUIPMENT_NOTES_LABEL,
  EQUIPMENT_NO_MONEY_NOTICE,
  EQUIPMENT_REPORTS_EMPTY_MESSAGE,
  EQUIPMENT_REPORTS_EMPTY_TITLE,
  EQUIPMENT_REPORT_ACTION,
  EQUIPMENT_REPORT_FIELD_LABEL,
  EQUIPMENT_REPORT_INVITE,
  EQUIPMENT_REPORT_NOT_A_STATUS,
  EQUIPMENT_REPORT_SUBMIT,
  EQUIPMENT_REPORT_WHO_SEES,
  EQUIPMENT_SERIAL_HINT,
  EQUIPMENT_SERIAL_LABEL,
  formatDateTime,
} from '@/lib/labels';
import type { Equipment, EquipmentCategory, EquipmentReport } from '@/lib/types';
import { EmptyState, ErrorAlert, FieldError, Modal, toApiError } from './shared';

/* ═════════════════════════════════════════════════════════════════════════
   Déclarer ou corriger une fiche — DIRECTEUR SEUL
   ═════════════════════════════════════════════════════════════════════════ */

const FORM_GRID: React.CSSProperties = {
  display: 'grid',
  /* `auto-fit` plutôt qu'un `1fr 1fr` figé : sur un Android d'entrée de gamme
     en portrait, deux colonnes de 150 px rendaient les libellés illisibles
     (correctif de la revue UX S3, valable pour toutes les modales du centre). */
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 'var(--ax-space-4)',
};

export function EquipmentFormModal({
  equipment,
  onClose,
  onSaved,
}: {
  /** Absent = déclaration ; présent = correction de la fiche existante. */
  equipment?: Equipment;
  onClose: () => void;
  onSaved: (saved: Equipment) => void;
}) {
  const { centerId } = useCenter();
  const editing = equipment !== undefined;

  const [name, setName] = useState(equipment?.name ?? '');
  const [category, setCategory] = useState<EquipmentCategory>(equipment?.category ?? 'diagnostic');
  const [serial, setSerial] = useState(equipment?.serial_number ?? '');
  const [location, setLocation] = useState(equipment?.location ?? '');
  const [commissionedOn, setCommissionedOn] = useState(equipment?.commissioned_on ?? '');
  const [notes, setNotes] = useState(equipment?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    /* `status` n'est JAMAIS envoyé ici : la machine à états a sa porte, et le
       backend l'ignorerait en silence — ce qui serait pire qu'un refus. */
    const payload = {
      name: name.trim(),
      category,
      serial_number: serial.trim(),
      location: location.trim(),
      commissioned_on: commissionedOn === '' ? null : commissionedOn,
      notes: notes.trim(),
    };
    try {
      const saved = equipment
        ? await updateEquipment(centerId, equipment.id, payload)
        : await createEquipment(centerId, payload);
      onSaved(saved);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? EQUIPMENT_EDIT_TITLE : EQUIPMENT_CREATE_TITLE}
      onClose={onClose}
      busy={saving}
      width={640}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="equipment-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || name.trim() === ''}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form
        id="equipment-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <div className="ax-field">
          <label className="ax-label" htmlFor="eq-name">
            {EQUIPMENT_NAME_LABEL}{' '}
            <span className="ax-field__required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="eq-name"
            type="text"
            className={`ax-input${error?.fieldErrors.name ? ' is-invalid' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
            autoComplete="off"
            data-autofocus=""
          />
          <span className="ax-field__message">{EQUIPMENT_NAME_HINT}</span>
          <FieldError error={error} field="name" />
        </div>

        <div style={FORM_GRID}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="eq-category">
              {EQUIPMENT_CATEGORY_LABEL}{' '}
              <span className="ax-field__required" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="eq-category"
              className="ax-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
            >
              {EQUIPMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EQUIPMENT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <FieldError error={error} field="category" />
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="eq-location">
              {EQUIPMENT_LOCATION_LABEL}
            </label>
            {/* Texte LIBRE, jamais une chambre : aucun sélecteur branché sur
                `inpatient/rooms/` (ADR 0021 décision 2). */}
            <input
              id="eq-location"
              type="text"
              className="ax-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
              autoComplete="off"
            />
            <span className="ax-field__message">{EQUIPMENT_LOCATION_HINT}</span>
            <FieldError error={error} field="location" />
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="eq-serial">
              {EQUIPMENT_SERIAL_LABEL}
            </label>
            {/* Aucune validation de format, aucun signalement de doublon : deux
                appareils identiques sans numéro sont un cas NORMAL. */}
            <input
              id="eq-serial"
              type="text"
              className="ax-input"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              maxLength={64}
              autoComplete="off"
            />
            <span className="ax-field__message">{EQUIPMENT_SERIAL_HINT}</span>
            <FieldError error={error} field="serial_number" />
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="eq-commissioned">
              {EQUIPMENT_COMMISSIONED_LABEL}
            </label>
            <input
              id="eq-commissioned"
              type="date"
              className="ax-input"
              value={commissionedOn}
              onChange={(e) => setCommissionedOn(e.target.value)}
            />
            <span className="ax-field__message">{EQUIPMENT_COMMISSIONED_HINT}</span>
            <FieldError error={error} field="commissioned_on" />
          </div>
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="eq-notes">
            {EQUIPMENT_NOTES_LABEL}
          </label>
          <textarea
            id="eq-notes"
            className="ax-textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <span className="ax-field__message">{EQUIPMENT_NOTES_HINT}</span>
          <FieldError error={error} field="notes" />
        </div>

        {/* Répond à la question au moment où elle se pose (« où je mets le prix
            d'achat ? ») plutôt que de laisser chercher un champ absent. */}
        <p
          style={{
            margin: 0,
            fontSize: 'var(--ax-text-xs)',
            color: 'var(--ax-text-muted)',
            lineHeight: 1.6,
          }}
        >
          {EQUIPMENT_NO_MONEY_NOTICE}
        </p>
      </form>
    </Modal>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   Signaler une panne — TOUT MEMBRE ACTIF, et rien ne le ferme
   ═════════════════════════════════════════════════════════════════════════ */

export function EquipmentReportModal({
  equipmentId,
  onClose,
  onReported,
}: {
  equipmentId: number;
  onClose: () => void;
  onReported: () => void;
}) {
  const { centerId } = useCenter();
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      /* La description, et RIEN d'autre : l'appareil voyage dans l'URL et
         l'auteur est l'appelant — on ne signale jamais au nom d'un collègue. */
      await reportEquipmentIssue(centerId, equipmentId, description.trim());
      onReported();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={EQUIPMENT_REPORT_ACTION}
      onClose={onClose}
      busy={saving}
      width={560}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="equipment-report-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || description.trim() === ''}
          >
            {saving ? 'Envoi…' : EQUIPMENT_REPORT_SUBMIT}
          </button>
        </>
      }
    >
      <form
        id="equipment-report-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {/* LA phrase du sprint, en TÊTE de la modale : sans elle, on croit
            avoir mis l'appareil hors service en le signalant. */}
        <div className="ax-alert ax-alert--info" role="note">
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
              {EQUIPMENT_REPORT_NOT_A_STATUS}
            </p>
          </div>
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="eq-report">
            {EQUIPMENT_REPORT_FIELD_LABEL}{' '}
            <span className="ax-field__required" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="eq-report"
            className={`ax-textarea${error?.fieldErrors.description ? ' is-invalid' : ''}`}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            required
            data-autofocus=""
          />
          <span className="ax-field__message">{EQUIPMENT_REPORT_INVITE}</span>
          <FieldError error={error} field="description" />
        </div>

        {/* On ne promet JAMAIS un anonymat qui n'existe pas : le fil ne porte
            pas l'auteur, la direction le connaît — le dire calmement vaut mieux
            qu'un silence qu'on découvrirait un jour de travers. */}
        <p
          style={{
            margin: 0,
            fontSize: 'var(--ax-text-xs)',
            color: 'var(--ax-text-muted)',
            lineHeight: 1.7,
          }}
        >
          {EQUIPMENT_REPORT_WHO_SEES}
        </p>
      </form>
    </Modal>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   Le fil des constats — deux audiences, un composant
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Un constat, rendu en item de timeline (`ax-timeline`, adapté de
 * `pages/Timeline.tsx` de Vireo).
 *
 * L'auteur n'est rendu QUE s'il est réellement arrivé dans le payload — et il
 * n'arrive que pour le directeur. Aucune branche ne fabrique de repli : ni
 * « Anonyme », ni tiret, ni bloc vide.
 */
function ReportItem({ report, showAuthor }: { report: EquipmentReport; showAuthor: boolean }) {
  const author = showAuthor ? report.reported_by_display : undefined;
  return (
    <li className="ax-timeline__item">
      <span className="ax-timeline__marker" style={{ color: 'var(--ax-warning-500)' }}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 9v4" />
          <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.871l-8.106 -13.534a1.914 1.914 0 0 0 -3.274 0z" />
          <path d="M12 16h.01" />
        </svg>
      </span>
      <div className="ax-timeline__content">
        <p
          className="ax-timeline__title"
          style={{ color: 'var(--ax-text-strong)', whiteSpace: 'pre-wrap' }}
        >
          {report.description}
        </p>
        {/* `ax-timeline__time` est en `--ax-text-subtle` (4,32:1, sous AA) dans
            le socle Vireo, où il ne porte qu'un horodatage décoratif. Ici la
            ligne porte du SENS — la date du constat, et pour le directeur le
            nom de qui l'a écrit — donc `--ax-text-muted`, AA dans les deux
            thèmes. Même correctif que `DetailItem` en S5. */}
        <span className="ax-timeline__time" style={{ color: 'var(--ax-text-muted)' }}>
          {formatDateTime(report.created_at)}
          {author && (
            <>
              {' · '}
              {author}
            </>
          )}
        </span>
      </div>
    </li>
  );
}

export function EquipmentReportFeed({
  reports,
  director,
}: {
  reports: EquipmentReport[];
  /** La casquette du centre ACTIF — premier des deux verrous. */
  director: boolean;
}) {
  /*
   * Second verrou : le champ doit être RÉELLEMENT là. Le rôle est juste
   * immédiatement (changement de centre), le payload l'est après
   * l'aller-retour — et aucune régression de sérialiseur ne suffit seule à
   * ouvrir le nom du signaleur au reste de l'équipe. Patron `Inpatient.tsx`.
   */
  const showAuthor = director && reports.some((r) => r.reported_by_display !== undefined);

  if (reports.length === 0) {
    return (
      <EmptyState
        title={EQUIPMENT_REPORTS_EMPTY_TITLE}
        message={EQUIPMENT_REPORTS_EMPTY_MESSAGE}
      />
    );
  }

  return (
    <ol className="ax-timeline" style={{ margin: 0, listStyle: 'none' }}>
      {reports.map((report) => (
        <ReportItem key={report.id} report={report} showAuthor={showAuthor} />
      ))}
    </ol>
  );
}
