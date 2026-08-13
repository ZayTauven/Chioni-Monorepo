'use client';
/*
 * Chioni — /centre/consultations : liste + création.
 *
 * L'API renvoie un sérialiseur DIFFÉRENT selon le rôle (R-API-1) : les rôles
 * cliniques voient `reason`/`diagnosis`, les rôles administratifs NON — la
 * colonne « Motif » ne s'affiche que si les données la portent réellement.
 * Filtres S1 : `?date=` (jour local) et `?practitioner=` (annuaire réel).
 * Création réservée aux rôles cliniques : patient (recherche), motif requis,
 * diagnostic, date, actes de la grille tarifaire (multi-sélection + total).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  createEncounter,
  listEncounters,
  listPatients,
  listPractitioners,
  listTariffs,
} from '@/lib/endpoints/centers';
import {
  ENCOUNTER_STATUS_LABELS,
  GENERIC_CATEGORY_LABELS,
  STAFF_ROLE_LABELS,
  formatDate,
  formatDateTime,
  formatKmf,
} from '@/lib/labels';
import type { Patient, TariffItem } from '@/lib/types';
import {
  AvatarChip,
  CLINICAL_ROLES,
  CardSkeleton,
  EmptyState,
  ENCOUNTER_TONES,
  ErrorAlert,
  FieldError,
  IconChevronRight,
  IconPlus,
  IconSearch,
  IconStethoscope,
  Modal,
  Pagination,
  StatusBadge,
  TableSkeleton,
  hasRole,
  patientLabel,
  toApiError,
  useAsync,
  useDebounced,
  usePatientNames,
} from './shared';

/* ── tariff loading (follows pagination, capped) ── */

async function fetchAllTariffs(centerId: number): Promise<TariffItem[]> {
  const all: TariffItem[] = [];
  let page = 1;
  // Garde-fou : 15 pages (300 actes) — au-delà, la grille est tronquée.
  while (page <= 15) {
    const chunk = await listTariffs(centerId, page);
    all.push(...chunk.results);
    if (!chunk.next) break;
    page += 1;
  }
  return all.filter((t) => t.is_active);
}

/* ── create modal ── */

export function CreateEncounterModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const { centerId } = useCenter();
  const [patientQ, setPatientQ] = useState('');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reason, setReason] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [selectedActs, setSelectedActs] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const debouncedQ = useDebounced(patientQ.trim());

  const candidates = useAsync(
    () => (debouncedQ ? listPatients(centerId, { q: debouncedQ, page: 1 }) : Promise.resolve(null)),
    [centerId, debouncedQ],
  );
  const tariffs = useAsync(() => fetchAllTariffs(centerId), [centerId]);

  const toggleAct = (id: number) =>
    setSelectedActs((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  const total = (tariffs.data ?? [])
    .filter((t) => selectedActs.includes(t.id))
    .reduce((sum, t) => sum + Number.parseFloat(t.price_kmf), 0);

  const submit = async () => {
    if (!patient) return;
    setSaving(true);
    setError(null);
    try {
      const encounter = await createEncounter(centerId, {
        patient: patient.id,
        reason: reason.trim(),
        ...(diagnosis.trim() ? { diagnosis: diagnosis.trim() } : {}),
        ...(occurredAt ? { occurred_at: new Date(occurredAt).toISOString() } : {}),
        ...(selectedActs.length > 0 ? { tariff_items: selectedActs } : {}),
      });
      onCreated(encounter.id);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nouvelle consultation"
      onClose={onClose}
      width={620}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="encounter-create-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || !patient || !reason.trim()}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer la consultation'}
          </button>
        </>
      }
    >
      <form
        id="encounter-create-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {/* Patient picker */}
        <div className="ax-field">
          <label className="ax-label" htmlFor="ne-patient">
            Patient <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          {patient ? (
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'center' }}>
              <AvatarChip name={`${patient.first_name} ${patient.last_name}`} seed={patient.id} />
              <span style={{ fontWeight: 500, color: 'var(--ax-text-strong)', flex: '1 1 auto' }}>
                {patient.first_name} {patient.last_name}
              </span>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setPatient(null)}>
                Changer
              </button>
            </div>
          ) : (
            <>
              <div className="ax-field__control">
                <span className="ax-field__affix ax-field__affix--leading">
                  <IconSearch className="" />
                </span>
                <input
                  id="ne-patient"
                  type="search"
                  className="ax-input ax-input--with-leading-icon"
                  placeholder="Rechercher un patient par nom ou téléphone…"
                  value={patientQ}
                  onChange={(e) => setPatientQ(e.target.value)}
                />
              </div>
              {debouncedQ && candidates.loading && <CardSkeleton lines={2} />}
              {debouncedQ && !candidates.loading && (candidates.data?.results.length ?? 0) === 0 && (
                <span className="ax-field__message">Aucun patient trouvé — créez d&apos;abord son dossier dans « Patients ».</span>
              )}
              {(candidates.data?.results.length ?? 0) > 0 && (
                <ul className="ax-list ax-list--compact" role="listbox" aria-label="Patients trouvés">
                  {candidates.data?.results.slice(0, 6).map((p) => (
                    <li key={p.id} className="ax-list__row">
                      <button
                        type="button"
                        onClick={() => setPatient(p)}
                        className="ax-btn ax-btn--ghost ax-btn--block"
                        style={{ justifyContent: 'flex-start', gap: 'var(--ax-space-3)' }}
                      >
                        <AvatarChip name={`${p.first_name} ${p.last_name}`} seed={p.id} />
                        <span className="ax-btn__label" style={{ textAlign: 'start' }}>
                          {p.first_name} {p.last_name}
                          <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontWeight: 400 }}>
                            {p.birth_date ? formatDate(p.birth_date) : 'Naissance inconnue'} · {p.phone || 'Sans téléphone'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <FieldError error={error} field="patient" />
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="ne-reason">
            Motif <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="ne-reason"
            type="text"
            className={`ax-input${error?.fieldErrors.reason ? ' is-invalid' : ''}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
          <FieldError error={error} field="reason" />
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="ne-diagnosis">Diagnostic</label>
          <textarea
            id="ne-diagnosis"
            className="ax-textarea"
            rows={2}
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
          />
          <FieldError error={error} field="diagnosis" />
        </div>

        <div className="ax-field" style={{ maxWidth: 280 }}>
          <label className="ax-label" htmlFor="ne-date">Date et heure</label>
          <input
            id="ne-date"
            type="datetime-local"
            className="ax-input"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
          <span className="ax-field__message">Laissez vide pour « maintenant ».</span>
          <FieldError error={error} field="occurred_at" />
        </div>

        {/* Acts from the tariff grid */}
        <div className="ax-field">
          <span className="ax-label">Actes réalisés (grille tarifaire)</span>
          {tariffs.loading ? (
            <CardSkeleton lines={3} />
          ) : tariffs.error ? (
            <ErrorAlert error={tariffs.error} onRetry={tariffs.reload} />
          ) : (tariffs.data?.length ?? 0) === 0 ? (
            <span className="ax-field__message">
              La grille tarifaire du centre est vide — les actes pourront être ajoutés une fois la grille remplie (page « Tarifs »).
            </span>
          ) : (
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-2)' }}>
              {tariffs.data?.map((t) => (
                <label
                  key={t.id}
                  className="ax-cluster"
                  style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-2)', cursor: 'pointer', borderRadius: 'var(--ax-radius-sm)' }}
                >
                  <input
                    type="checkbox"
                    className="ax-checkbox"
                    checked={selectedActs.includes(t.id)}
                    onChange={() => toggleAct(t.id)}
                  />
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>{t.label}</span>
                    <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                      {t.code} · {GENERIC_CATEGORY_LABELS[t.generic_category]}
                    </span>
                  </span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)', whiteSpace: 'nowrap' }}>
                    {formatKmf(t.price_kmf)}
                  </b>
                </label>
              ))}
            </div>
          )}
          {selectedActs.length > 0 && (
            <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                {selectedActs.length} acte{selectedActs.length > 1 ? 's' : ''} sélectionné{selectedActs.length > 1 ? 's' : ''}
              </span>
              <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>{formatKmf(String(total))}</b>
            </div>
          )}
          <FieldError error={error} field="tariff_items" />
        </div>
      </form>
    </Modal>
  );
}

/* ── screen ── */

export function Consultations() {
  const { centerId, role } = useCenter();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const clinical = hasRole(role, CLINICAL_ROLES);
  /** Filtres serveur S1 : jour local (`?date=`) et praticien (`?practitioner=`). */
  const [dateFilter, setDateFilter] = useState('');
  const [practitionerFilter, setPractitionerFilter] = useState<number | ''>('');

  const practitioners = useAsync(() => listPractitioners(centerId), [centerId]);
  const encounters = useAsync(
    () =>
      listEncounters(centerId, {
        page,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(practitionerFilter !== '' ? { practitioner: practitionerFilter } : {}),
      }),
    [centerId, page, dateFilter, practitionerFilter],
  );
  const results = encounters.data?.results ?? [];
  const hasClinicalFields = results.some((e) => e.reason !== undefined);
  const patientNames = usePatientNames(centerId, results.map((e) => e.patient));
  const hasFilters = dateFilter !== '' || practitionerFilter !== '';

  // Reset to page 1 when switching centers or filters.
  useEffect(() => {
    setPage(1);
  }, [centerId, dateFilter, practitionerFilter]);

  return (
    <>
      <PageHead
        title="Consultations"
        subtitle={
          clinical
            ? 'Consultations du centre — vue clinique.'
            : 'Consultations du centre — vue exploitation (le motif et le diagnostic sont réservés aux soignants).'
        }
        actions={
          clinical ? (
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setCreateOpen(true)}>
              <IconPlus />
              <span className="ax-btn__label">Nouvelle consultation</span>
            </button>
          ) : undefined
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Liste des consultations">
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="ax-field" style={{ marginBottom: 0 }}>
                <label className="ax-label" htmlFor="enc-f-date">Jour</label>
                <input
                  id="enc-f-date"
                  type="date"
                  className="ax-input"
                  style={{ width: 170 }}
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
              <div className="ax-field" style={{ marginBottom: 0 }}>
                <label className="ax-label" htmlFor="enc-f-practitioner">Soignant</label>
                <select
                  id="enc-f-practitioner"
                  className="ax-select"
                  style={{ minWidth: 180 }}
                  value={practitionerFilter === '' ? '' : String(practitionerFilter)}
                  onChange={(e) =>
                    setPractitionerFilter(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))
                  }
                >
                  <option value="">Tous les soignants</option>
                  {(practitioners.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} — {STAFF_ROLE_LABELS[p.role]}
                    </option>
                  ))}
                </select>
              </div>
              {hasFilters && (
                <button
                  type="button"
                  className="ax-btn ax-btn--ghost ax-btn--sm"
                  onClick={() => {
                    setDateFilter('');
                    setPractitionerFilter('');
                  }}
                >
                  Effacer les filtres
                </button>
              )}
            </div>
          </div>
          {encounters.loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : encounters.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={encounters.error} onRetry={encounters.reload} />
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title="Aucune consultation"
              message={
                hasFilters
                  ? 'Aucune consultation ne correspond à ces filtres.'
                  : clinical
                    ? 'Enregistrez la première consultation avec le bouton « Nouvelle consultation ».'
                    : 'Les consultations créées par l’équipe soignante apparaîtront ici.'
              }
              action={
                clinical && !hasFilters ? (
                  <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setCreateOpen(true)}>
                    <IconStethoscope />
                    <span className="ax-btn__label">Nouvelle consultation</span>
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Patient</th>
                      <th className="ax-table__th" scope="col">Date</th>
                      {hasClinicalFields && <th className="ax-table__th" scope="col">Motif</th>}
                      <th className="ax-table__th" scope="col">Soignant</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Actes</th>
                      <th className="ax-table__th" scope="col">Statut</th>
                      <th className="ax-table__th" scope="col"><span className="ax-visually-hidden">Ouvrir</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((e) => (
                      <tr
                        key={e.id}
                        className="ax-table__row"
                        onClick={() => router.push(`/centre/consultations/${e.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="ax-table__td">
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                            <AvatarChip name={patientLabel(patientNames, e.patient)} seed={e.patient} />
                            <Link
                              href={`/centre/consultations/${e.id}`}
                              className="ax-link"
                              onClick={(ev) => ev.stopPropagation()}
                              style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}
                            >
                              {patientLabel(patientNames, e.patient)}
                            </Link>
                          </div>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(e.occurred_at)}
                        </td>
                        {hasClinicalFields && (
                          <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', maxWidth: 260 }}>
                            <span className="ax-truncate" style={{ display: 'block' }}>{e.reason ?? '—'}</span>
                          </td>
                        )}
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{e.practitioner_name}</td>
                        <td className="ax-table__td ax-table__td--num ax-num">{e.acts.length}</td>
                        <td className="ax-table__td">
                          <StatusBadge tone={ENCOUNTER_TONES[e.status]} label={ENCOUNTER_STATUS_LABELS[e.status]} />
                        </td>
                        <td className="ax-table__td" style={{ textAlign: 'end' }}>
                          <IconChevronRight className="" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {encounters.data && <Pagination count={encounters.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>

      {createOpen && (
        <CreateEncounterModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            router.push(`/centre/consultations/${id}`);
          }}
        />
      )}
    </>
  );
}

export default Consultations;
