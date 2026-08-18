'use client';
/*
 * Chioni — /centre/consultations/[id] : détail d'une consultation.
 *
 * Segmentation par rôle, fidèle au backend (R-API-1) :
 * - motif/diagnostic : présents seulement dans le payload clinique — l'écran
 *   rend proprement les deux cas ;
 * - ordonnances : lecture cliniques + pharmacien, ajout medecin/sage_femme
 *   (POST {items:[{medication,dosage}]}, vérifié dans medical/serializers.py) ;
 * - entrées de carnet : lecture/ajout rôles cliniques uniquement (la liste
 *   renvoyée couvre les entrées du patient produites par CE centre).
 * - clôture (S1) : rôles cliniques SEULS (le directeur non-clinicien reçoit
 *   403) — une consultation terminée n'accepte plus d'ordonnances ni
 *   d'entrées au carnet ; la facturation reste possible.
 * Les sous-ressources ne sont PAS appelées quand le rôle n'y a pas droit :
 * l'écran l'explique honnêtement au lieu d'afficher un 403.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  closeEncounter,
  createPrescription,
  createRecordEntry,
  getEncounter,
  getPatient,
  listEncounterPrescriptions,
  listEncounterRecordEntries,
  type EncounterStaff,
} from '@/lib/endpoints/centers';
import {
  AVAILABILITY_SEND_ACTION,
  COUNTER_SEARCH_DISABLED_HINT,
  ENCOUNTER_STATUS_LABELS,
  GENERIC_CATEGORY_LABELS,
  PRESCRIPTION_STATUS_LABELS,
  RECORD_ENTRY_TYPE_LABELS,
  availabilitySent,
  counterDeliveredOn,
  formatDate,
  formatDateTime,
  formatKmf,
} from '@/lib/labels';
import type { Prescription, RecordEntryType } from '@/lib/types';
import { AvailabilitySendModal } from './AvailabilitySend';
import { VitalSignsCard } from './VitalSignsCard';
import {
  BILLING_ROLES,
  CLINICAL_ROLES,
  CardSkeleton,
  DetailItem,
  EmptyState,
  ENCOUNTER_TONES,
  ErrorAlert,
  FieldError,
  IconArrowLeft,
  IconCheck,
  IconPlus,
  Modal,
  PRESCRIBER_ROLES,
  PRESCRIPTION_READ_ROLES,
  StatusBadge,
  hasRole,
  toApiError,
  useAsync,
} from './shared';

/* ── close confirmation (S1 — clinical roles only) ── */

function CloseEncounterModal({
  encounterId,
  onClose,
  onClosed,
}: {
  encounterId: number;
  onClose: () => void;
  onClosed: (fresh: EncounterStaff) => void;
}) {
  const { centerId } = useCenter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      onClosed(await closeEncounter(centerId, encounterId));
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Clôturer la consultation ?"
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving} data-autofocus="">
            Pas encore
          </button>
          <button type="button" className="ax-btn ax-btn--primary" onClick={() => void submit()} disabled={saving}>
            <IconCheck />
            <span className="ax-btn__label">{saving ? 'Clôture…' : 'Clôturer'}</span>
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
        Une consultation terminée n&apos;accepte plus d&apos;ordonnances ni d&apos;entrées au carnet.
        La facturation des actes, elle, reste possible.
      </p>
    </Modal>
  );
}

/* ── prescription creation modal ── */

interface PrescriptionRow {
  medication: string;
  dosage: string;
}

function PrescriptionModal({
  encounterId,
  onClose,
  onCreated,
}: {
  encounterId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { centerId } = useCenter();
  const [rows, setRows] = useState<PrescriptionRow[]>([{ medication: '', dosage: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const setRow = (index: number, patch: Partial<PrescriptionRow>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const validRows = rows.filter((r) => r.medication.trim());

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await createPrescription(
        centerId,
        encounterId,
        validRows.map((r) => ({ medication: r.medication.trim(), dosage: r.dosage.trim() })),
      );
      onCreated();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nouvelle ordonnance"
      busy={saving}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => void submit()}
            disabled={saving || validRows.length === 0}
          >
            {saving ? 'Enregistrement…' : "Émettre l'ordonnance"}
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <FieldError error={error} field="items" />
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 'var(--ax-space-3)', alignItems: 'end' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor={`rx-med-${i}`}>Médicament</label>
            <input
              id={`rx-med-${i}`}
              type="text"
              className="ax-input"
              value={row.medication}
              onChange={(e) => setRow(i, { medication: e.target.value })}
            />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor={`rx-dose-${i}`}>Posologie</label>
            <input
              id={`rx-dose-${i}`}
              type="text"
              className="ax-input"
              value={row.dosage}
              onChange={(e) => setRow(i, { dosage: e.target.value })}
              placeholder="ex. 1 comprimé matin et soir, 5 jours"
            />
          </div>
          <button
            type="button"
            className="ax-btn ax-btn--ghost ax-btn--icon"
            onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
            aria-label={`Retirer la ligne ${i + 1}`}
            disabled={rows.length === 1}
          >
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /></svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        className="ax-btn ax-btn--secondary ax-btn--sm"
        onClick={() => setRows((prev) => [...prev, { medication: '', dosage: '' }])}
        style={{ alignSelf: 'flex-start' }}
      >
        <IconPlus />
        <span className="ax-btn__label">Ajouter une ligne</span>
      </button>
    </Modal>
  );
}

/* ── record entry modal ── */

function RecordEntryModal({
  encounterId,
  onClose,
  onCreated,
}: {
  encounterId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { centerId } = useCenter();
  const [entryType, setEntryType] = useState<RecordEntryType>('antecedent');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await createRecordEntry(centerId, encounterId, { entry_type: entryType, content: content.trim() });
      onCreated();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nouvelle entrée de carnet"
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => void submit()}
            disabled={saving || !content.trim()}
          >
            {saving ? 'Enregistrement…' : 'Ajouter au carnet'}
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <div className="ax-field">
        <label className="ax-label" htmlFor="re-type">Type</label>
        <select id="re-type" className="ax-select" value={entryType} onChange={(e) => setEntryType(e.target.value as RecordEntryType)}>
          {(Object.keys(RECORD_ENTRY_TYPE_LABELS) as RecordEntryType[]).map((t) => (
            <option key={t} value={t}>
              {RECORD_ENTRY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <FieldError error={error} field="entry_type" />
      </div>
      <div className="ax-field">
        <label className="ax-label" htmlFor="re-content">Contenu</label>
        <textarea id="re-content" className="ax-textarea" rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
        <FieldError error={error} field="content" />
      </div>
    </Modal>
  );
}

/* ── screen ── */

export function ConsultationDetail({ encounterId }: { encounterId: number }) {
  const { centerId, roles } = useCenter();
  const clinical = hasRole(roles, CLINICAL_ROLES);
  const canReadPrescriptions = hasRole(roles, PRESCRIPTION_READ_ROLES);
  const canPrescribe = hasRole(roles, PRESCRIBER_ROLES);
  const billing = hasRole(roles, BILLING_ROLES);

  const [rxOpen, setRxOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  /*
   * S9 — chercher les médicaments d'une ordonnance dans le réseau. Le geste est
   * monté ICI en plus du comptoir parce que c'est « le bon moment, la bonne
   * personne » (arbitrage PO n° 3 de l'ADR 0022) : la recherche part en fin de
   * consultation, pendant que le patient est encore là. La modale est le
   * composant PARTAGÉ avec `/centre/ordonnances` — deux copies auraient
   * divergé sur les phrases de confidentialité, qui sont l'essentiel.
   */
  const [searchingRx, setSearchingRx] = useState<Prescription | null>(null);
  const [availabilityFlash, setAvailabilityFlash] = useState<string | null>(null);
  /** Rafraîchi en place après la clôture (S1) — pas de re-fetch complet. */
  const [freshEncounter, setFreshEncounter] = useState<EncounterStaff | null>(null);

  const encounter = useAsync(() => getEncounter(centerId, encounterId), [centerId, encounterId]);
  const patient = useAsync(
    () => (encounter.data ? getPatient(centerId, encounter.data.patient) : Promise.resolve(null)),
    [centerId, encounter.data?.patient],
  );
  const prescriptions = useAsync(
    () =>
      canReadPrescriptions
        ? listEncounterPrescriptions(centerId, encounterId)
        : Promise.resolve(null),
    [centerId, encounterId, canReadPrescriptions],
  );
  const recordEntries = useAsync(
    () => (clinical ? listEncounterRecordEntries(centerId, encounterId) : Promise.resolve(null)),
    [centerId, encounterId, clinical],
  );

  if (encounter.loading) {
    return (
      <>
        <PageHead title="Consultation" />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--5"><CardSkeleton lines={6} /></section>
          <section className="ax-card ax-col--7"><CardSkeleton lines={6} /></section>
        </div>
      </>
    );
  }

  if (encounter.error || !encounter.data) {
    return (
      <>
        <PageHead title="Consultation" />
        <div className="ax-dash-grid">
          <div className="ax-col--12">
            <ErrorAlert error={encounter.error ?? toApiError(null)} onRetry={encounter.reload} />
            <p style={{ marginTop: 'var(--ax-space-4)' }}>
              <Link href="/centre/consultations" className="ax-btn ax-btn--secondary">
                <IconArrowLeft />
                <span className="ax-btn__label">Retour aux consultations</span>
              </Link>
            </p>
          </div>
        </div>
      </>
    );
  }

  const e = freshEncounter ?? encounter.data;
  const actsTotal = e.acts.reduce((sum, a) => sum + Number.parseFloat(a.price_kmf_snapshot), 0);
  const patientName = patient.data
    ? `${patient.data.first_name} ${patient.data.last_name}`.trim()
    : `Patient n° ${e.patient}`;

  return (
    <>
      <PageHead
        title={`Consultation n° ${e.id}`}
        subtitle={`${formatDateTime(e.occurred_at)} · ${e.practitioner_name}`}
        actions={
          <>
            <Link href="/centre/consultations" className="ax-btn ax-btn--secondary">
              <IconArrowLeft />
              <span className="ax-btn__label">Retour</span>
            </Link>
            {/* S1 : clôture par les rôles cliniques seuls (403 sinon). */}
            {clinical && e.status === 'en_cours' && (
              <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setCloseOpen(true)}>
                <IconCheck />
                <span className="ax-btn__label">Clôturer la consultation</span>
              </button>
            )}
            {billing && e.acts.length > 0 && (
              <Link href={`/centre/factures?encounter=${e.id}`} className="ax-btn ax-btn--primary">
                <IconPlus />
                <span className="ax-btn__label">Créer une facture</span>
              </Link>
            )}
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Infos */}
        <section className="ax-card ax-col--5" role="region" aria-label="Informations">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Informations</h2>
            </div>
            <StatusBadge tone={ENCOUNTER_TONES[e.status]} label={ENCOUNTER_STATUS_LABELS[e.status]} />
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <DetailItem label="Patient">
              <Link href={`/centre/patients/${e.patient}`} className="ax-link" style={{ fontWeight: 500 }}>
                {patientName}
              </Link>
            </DetailItem>
            <DetailItem label="Date">{formatDateTime(e.occurred_at)}</DetailItem>
            <DetailItem label="Soignant">{e.practitioner_name}</DetailItem>
            {e.reason !== undefined ? (
              <>
                <DetailItem label="Motif">{e.reason || '—'}</DetailItem>
                <DetailItem label="Diagnostic">{e.diagnosis || '—'}</DetailItem>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                Le motif et le diagnostic sont réservés aux rôles soignants (secret médical).
              </p>
            )}
          </div>
        </section>

        {/* Actes */}
        <section className="ax-card ax-col--7" role="region" aria-label="Actes réalisés">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Actes réalisés</h2>
              <p className="ax-card__subtitle">Tarifs figés au moment de la consultation</p>
            </div>
          </div>
          {e.acts.length === 0 ? (
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <EmptyState title="Aucun acte" message="Aucun acte de la grille tarifaire n'a été rattaché à cette consultation." />
            </div>
          ) : (
            <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
              <table className="ax-table">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">Acte</th>
                    <th className="ax-table__th" scope="col">Catégorie</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {e.acts.map((a) => (
                    <tr key={a.id} className="ax-table__row">
                      <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)', fontWeight: 500 }}>{a.label_snapshot}</td>
                      <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                        {GENERIC_CATEGORY_LABELS[a.generic_category]}
                      </td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                        {formatKmf(a.price_kmf_snapshot)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="ax-table__foot">
                  <tr>
                    <td className="ax-table__td" colSpan={2} style={{ fontWeight: 600, color: 'var(--ax-text-strong)' }}>Total</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>
                      {formatKmf(String(actsTotal))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Signes vitaux (S3) — sphère clinique : la carte n'est JAMAIS montée
            (ni son fetch lancé) pour les rôles administratifs/pharmacien. */}
        {clinical && <VitalSignsCard encounterId={e.id} status={e.status} />}

        {/* Ordonnances */}
        <section className="ax-card ax-col--6" role="region" aria-label="Ordonnances">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Ordonnances</h2>
            </div>
            {canPrescribe && e.status === 'en_cours' && (
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setRxOpen(true)}>
                <IconPlus />
                <span className="ax-btn__label">Nouvelle ordonnance</span>
              </button>
            )}
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {availabilityFlash && (
              <div className="ax-alert ax-alert--success" role="status" style={{ marginBlockEnd: 'var(--ax-space-3)' }}>
                <div className="ax-alert__content">
                  <p className="ax-alert__message">{availabilityFlash}</p>
                </div>
              </div>
            )}
            {canPrescribe && e.status === 'terminee' && (
              <p style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                Consultation terminée : elle n&apos;accepte plus de nouvelle ordonnance.
              </p>
            )}
            {!canReadPrescriptions ? (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                Les ordonnances sont réservées aux soignants et au pharmacien (secret médical).
              </p>
            ) : prescriptions.loading ? (
              <CardSkeleton lines={3} />
            ) : prescriptions.error ? (
              <ErrorAlert error={prescriptions.error} onRetry={prescriptions.reload} />
            ) : (prescriptions.data?.length ?? 0) === 0 ? (
              <EmptyState title="Aucune ordonnance" message="Aucune ordonnance n'a été émise pour cette consultation." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                {prescriptions.data?.map((rx) => (
                  <div key={rx.id} style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)' }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                      <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>
                        Ordonnance n° {rx.id} · {formatDate(rx.created_at)}
                      </b>
                      <StatusBadge tone={rx.status === 'delivree' ? 'success' : 'info'} label={PRESCRIPTION_STATUS_LABELS[rx.status]} />
                    </div>
                    <ul style={{ margin: 0, paddingInlineStart: 'var(--ax-space-5)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
                      {rx.items.map((item) => (
                        <li key={item.id}>
                          <b>{item.medication}</b>
                          {item.dosage ? ` — ${item.dosage}` : ''}
                        </li>
                      ))}
                    </ul>
                    {/* S9 — chercher en pharmacie, ou dire pourquoi c'est
                        impossible. Une ordonnance DÉLIVRÉE ne se recherche
                        plus : le bouton disparaît et la raison prend sa place,
                        plutôt qu'un bouton grisé sans explication. */}
                    <div style={{ marginTop: 'var(--ax-space-3)' }}>
                      {rx.status === 'emise' ? (
                        <button
                          type="button"
                          className="ax-btn ax-btn--secondary ax-btn--sm"
                          onClick={() => setSearchingRx(rx)}
                        >
                          <span className="ax-btn__label">{AVAILABILITY_SEND_ACTION}</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          {rx.delivered_at
                            ? `${counterDeliveredOn(rx.delivered_at)} · ${COUNTER_SEARCH_DISABLED_HINT}`
                            : COUNTER_SEARCH_DISABLED_HINT}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Carnet */}
        <section className="ax-card ax-col--6" role="region" aria-label="Entrées de carnet">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Carnet de santé</h2>
              <p className="ax-card__subtitle">Entrées du patient produites par ce centre</p>
            </div>
            {clinical && e.status === 'en_cours' && (
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setEntryOpen(true)}>
                <IconPlus />
                <span className="ax-btn__label">Ajouter une entrée</span>
              </button>
            )}
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {clinical && e.status === 'terminee' && (
              <p style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                Consultation terminée : elle n&apos;accepte plus d&apos;entrée au carnet.
              </p>
            )}
            {!clinical ? (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                Le carnet de santé est réservé aux rôles soignants (secret médical).
              </p>
            ) : recordEntries.loading ? (
              <CardSkeleton lines={3} />
            ) : recordEntries.error ? (
              <ErrorAlert error={recordEntries.error} onRetry={recordEntries.reload} />
            ) : (recordEntries.data?.length ?? 0) === 0 ? (
              <EmptyState title="Carnet vide côté centre" message="Aucune entrée de carnet produite par ce centre pour ce patient." />
            ) : (
              <ul className="ax-list ax-list--compact">
                {recordEntries.data?.map((entry) => (
                  <li key={entry.id} className="ax-list__row">
                    <span className="ax-list__content">
                      <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                        {RECORD_ENTRY_TYPE_LABELS[entry.entry_type]}
                      </span>
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{entry.content}</span>
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                        {formatDate(entry.created_at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {searchingRx && (
        <AvailabilitySendModal
          /* Voir `Prescriptions.tsx` : les cases cochées sont semées au
             montage, elles ne passent jamais d'une ordonnance à l'autre. */
          key={searchingRx.id}
          prescription={searchingRx}
          onClose={() => setSearchingRx(null)}
          onSent={(count) => {
            setSearchingRx(null);
            setAvailabilityFlash(availabilitySent(count));
          }}
        />
      )}
      {rxOpen && (
        <PrescriptionModal
          encounterId={e.id}
          onClose={() => setRxOpen(false)}
          onCreated={() => {
            setRxOpen(false);
            prescriptions.reload();
          }}
        />
      )}
      {entryOpen && (
        <RecordEntryModal
          encounterId={e.id}
          onClose={() => setEntryOpen(false)}
          onCreated={() => {
            setEntryOpen(false);
            recordEntries.reload();
          }}
        />
      )}
      {closeOpen && (
        <CloseEncounterModal
          encounterId={e.id}
          onClose={() => setCloseOpen(false)}
          onClosed={(fresh) => {
            setCloseOpen(false);
            setFreshEncounter(fresh);
          }}
        />
      )}
    </>
  );
}

export default ConsultationDetail;
