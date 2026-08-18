'use client';
/*
 * Chioni — les dossiers du personnel (S7, ADR 0020 décision 1). DIRECTEUR SEUL.
 *
 * Le pivot du module est `Employment` — **une personne, un centre, UN
 * dossier** — et surtout pas `StaffMembership`, qui est unique par (personne,
 * centre, RÔLE) : un médecin qui est aussi directeur porte deux casquettes et
 * un seul dossier. Le sélecteur de création prend donc un id de COMPTE
 * (`row.user.id` de l'annuaire du personnel), et il déduplique.
 *
 * Asset Vireo : la table « Recent Hires » de `dashboards/Hr.tsx` (l. 273-310)
 * — colonnes Employee / Role / Department / Start date, avatar teinté,
 * badge de service. Sa colonne « Status » (Active / Onboarding) est remplacée
 * par l'état réel du dossier (`is_running`), et **aucune colonne de
 * rémunération n'existe** : la paie est hors périmètre et le restera jusqu'à
 * son propre cadrage (décision 8).
 */
import { useMemo, useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import { listStaff } from '@/lib/endpoints/centers';
import {
  createEmployment,
  listDepartments,
  listEmployments,
  listJobTitles,
  updateEmployment,
} from '@/lib/endpoints/hrm';
import {
  HRM_JOB_TITLE_NO_RIGHTS,
  HRM_JOB_TITLE_NO_RIGHTS_SHORT,
  HRM_NO_EMPLOYMENT_DIRECTOR,
  HRM_NO_EMPLOYMENT_TITLE,
  STAFF_ROLE_LABELS,
  formatDate,
  todayIsoDate,
} from '@/lib/labels';
import type { Employment, StaffMember } from '@/lib/types';
import type { ApiError } from '@/lib/api';
import {
  AvatarChip,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconEdit,
  IconPlus,
  Modal,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
} from './shared';

/** Garde-fou de chargement de l'annuaire : 5 pages (100 casquettes). */
async function fetchStaff(centerId: number): Promise<StaffMember[]> {
  const items: StaffMember[] = [];
  let page = 1;
  while (page <= 5) {
    const chunk = await listStaff(centerId, page);
    items.push(...chunk.results);
    if (!chunk.next) break;
    page += 1;
  }
  return items;
}

/* ── modale : ouvrir ou modifier un dossier ── */

function EmploymentModal({
  employment,
  taken,
  onClose,
  onSaved,
}: {
  /** `null` = ouverture d'un nouveau dossier. */
  employment: Employment | null;
  /** Ids de comptes ayant DÉJÀ un dossier — une personne = un dossier. */
  taken: number[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { centerId } = useCenter();
  const editing = employment !== null;

  const [userId, setUserId] = useState<number | ''>('');
  const [hiredAt, setHiredAt] = useState(employment?.hired_at ?? todayIsoDate());
  const [endedAt, setEndedAt] = useState(employment?.ended_at ?? '');
  const [departmentId, setDepartmentId] = useState<number | ''>(employment?.department ?? '');
  const [jobTitleId, setJobTitleId] = useState<number | ''>(employment?.job_title ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const staff = useAsync(
    () => (editing ? Promise.resolve<StaffMember[]>([]) : fetchStaff(centerId)),
    [centerId, editing],
  );
  const departments = useAsync(() => listDepartments(centerId), [centerId]);
  const jobTitles = useAsync(() => listJobTitles(centerId), [centerId]);

  /* L'annuaire liste une ligne PAR CASQUETTE : on déduplique par compte, et on
     retire les personnes qui ont déjà un dossier (le backend le refuserait de
     toute façon — mieux vaut ne pas proposer le refus). */
  const candidates = useMemo(() => {
    const byUser = new Map<number, StaffMember>();
    for (const member of staff.data ?? []) {
      if (!member.is_active) continue;
      if (taken.includes(member.user.id)) continue;
      if (!byUser.has(member.user.id)) byUser.set(member.user.id, member);
    }
    return [...byUser.values()];
  }, [staff.data, taken]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateEmployment(centerId, employment.id, {
          hired_at: hiredAt,
          ended_at: endedAt === '' ? null : endedAt,
          department: departmentId === '' ? null : departmentId,
          job_title: jobTitleId === '' ? null : jobTitleId,
        });
      } else {
        if (userId === '') return;
        await createEmployment(centerId, {
          user: userId,
          hired_at: hiredAt,
          ...(departmentId === '' ? {} : { department: departmentId }),
          ...(jobTitleId === '' ? {} : { job_title: jobTitleId }),
        });
      }
      onSaved();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  };

  const activeDepartments = (departments.data ?? []).filter(
    (d) => d.is_active || d.id === employment?.department,
  );
  const activeJobTitles = (jobTitles.data ?? []).filter(
    (j) => j.is_active || j.id === employment?.job_title,
  );

  return (
    <Modal
      title={editing ? `Dossier de ${employment.user_display_name}` : 'Ouvrir un dossier'}
      onClose={onClose}
      busy={busy}
      width={560}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button
            type="submit"
            form="employment-form"
            className="ax-btn ax-btn--primary"
            disabled={busy || (!editing && userId === '') || hiredAt === ''}
          >
            {busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ouvrir le dossier'}
          </button>
        </>
      }
    >
      <form
        id="employment-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {!editing && (
          <div className="ax-field">
            <label className="ax-label" htmlFor="emp-user">
              Personne{' '}
              <span className="ax-field__required" aria-hidden="true">
                *
              </span>
            </label>
            {staff.loading ? (
              <CardSkeleton lines={2} />
            ) : (
              <>
                <select
                  id="emp-user"
                  className="ax-select"
                  value={userId === '' ? '' : String(userId)}
                  onChange={(e) =>
                    setUserId(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))
                  }
                  data-autofocus=""
                  required
                >
                  <option value="">Choisir dans le personnel…</option>
                  {candidates.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {`${member.user.first_name} ${member.user.last_name}`.trim() ||
                        `Compte n° ${member.user.id}`}{' '}
                      — {STAFF_ROLE_LABELS[member.role]}
                    </option>
                  ))}
                </select>
                <span className="ax-field__message">
                  {candidates.length === 0
                    ? 'Toutes les personnes du personnel ont déjà un dossier. Ajoutez d’abord un membre dans « Personnel ».'
                    : 'Une personne n’a qu’un seul dossier, même si elle porte plusieurs casquettes dans le centre.'}
                </span>
              </>
            )}
            <FieldError error={error} field="user" />
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--ax-space-4)',
          }}
        >
          <div className="ax-field">
            <label className="ax-label" htmlFor="emp-hired">
              Date d&rsquo;embauche{' '}
              <span className="ax-field__required" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="emp-hired"
              type="date"
              className={`ax-input${error?.fieldErrors.hired_at ? ' is-invalid' : ''}`}
              value={hiredAt}
              onChange={(e) => setHiredAt(e.target.value)}
              required
            />
            <FieldError error={error} field="hired_at" />
          </div>

          {editing && (
            <div className="ax-field">
              <label className="ax-label" htmlFor="emp-ended">
                Fin de l&rsquo;emploi
              </label>
              <input
                id="emp-ended"
                type="date"
                className={`ax-input${error?.fieldErrors.ended_at ? ' is-invalid' : ''}`}
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
              />
              <span className="ax-field__message">
                Laissez vide tant que la personne travaille ici. Son registre est conservé après
                son départ.
              </span>
              <FieldError error={error} field="ended_at" />
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--ax-space-4)',
          }}
        >
          <div className="ax-field">
            <label className="ax-label" htmlFor="emp-dept">
              Service
            </label>
            <select
              id="emp-dept"
              className="ax-select"
              value={departmentId === '' ? '' : String(departmentId)}
              onChange={(e) =>
                setDepartmentId(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))
              }
            >
              <option value="">Aucun service</option>
              {activeDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <FieldError error={error} field="department" />
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="emp-job">
              Fonction
            </label>
            <select
              id="emp-job"
              className="ax-select"
              value={jobTitleId === '' ? '' : String(jobTitleId)}
              onChange={(e) =>
                setJobTitleId(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))
              }
            >
              <option value="">Aucune fonction</option>
              {activeJobTitles.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
            {/* La phrase la plus importante du module, au CONTACT du champ. */}
            <span className="ax-field__message">{HRM_JOB_TITLE_NO_RIGHTS_SHORT}</span>
            <FieldError error={error} field="job_title" />
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ── écran ── */

export function HrEmployments() {
  const { centerId } = useCenter();
  const [showEnded, setShowEnded] = useState(false);
  const [modal, setModal] = useState<{ employment: Employment | null } | null>(null);

  const employments = useAsync(
    () => listEmployments(centerId, showEnded ? {} : { running: true }),
    [centerId, showEnded],
  );
  /* La liste complète sert de garde au sélecteur : une personne = un dossier,
     y compris si son dossier est clos (le backend refuserait un second). */
  const all = useAsync(() => listEmployments(centerId), [centerId]);

  const rows = employments.data ?? [];
  const taken = useMemo(() => (all.data ?? []).map((e) => e.user), [all.data]);

  return (
    <>
      <section className="ax-card ax-col--12" role="region" aria-label="Dossiers du personnel">
        <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
          <div className="ax-card__titles">
            <h2 className="ax-card__title">Dossiers</h2>
            <p className="ax-card__subtitle">
              Un dossier par personne : c&rsquo;est lui qui porte sa feuille de présence et ses
              congés.
            </p>
          </div>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
            <label
              className="ax-cluster"
              style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                className="ax-checkbox"
                checked={showEnded}
                onChange={(e) => setShowEnded(e.target.checked)}
              />
              <span style={{ color: 'var(--ax-text-muted)' }}>Afficher les dossiers clos</span>
            </label>
            <button
              type="button"
              className="ax-btn ax-btn--primary"
              onClick={() => setModal({ employment: null })}
            >
              <IconPlus />
              <span className="ax-btn__label">Ouvrir un dossier</span>
            </button>
          </div>
        </div>

        <div className="ax-card__body" style={{ paddingTop: 0 }}>
          <div className="ax-alert ax-alert--info" role="note" style={{ marginBottom: 'var(--ax-space-4)' }}>
            <div className="ax-alert__content">
              <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                {HRM_JOB_TITLE_NO_RIGHTS}
              </p>
            </div>
          </div>
        </div>

        {employments.loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : employments.error ? (
          <div style={{ padding: 'var(--ax-space-4)' }}>
            <ErrorAlert error={employments.error} onRetry={employments.reload} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={HRM_NO_EMPLOYMENT_TITLE}
            message={HRM_NO_EMPLOYMENT_DIRECTOR}
            action={
              <button
                type="button"
                className="ax-btn ax-btn--secondary"
                onClick={() => setModal({ employment: null })}
              >
                <IconPlus />
                <span className="ax-btn__label">Ouvrir un dossier</span>
              </button>
            }
          />
        ) : (
          <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">
                    Personne
                  </th>
                  <th className="ax-table__th" scope="col">
                    Service
                  </th>
                  <th className="ax-table__th" scope="col">
                    Fonction
                  </th>
                  <th className="ax-table__th" scope="col">
                    Depuis le
                  </th>
                  <th className="ax-table__th" scope="col">
                    État
                  </th>
                  <th className="ax-table__th" scope="col">
                    <span className="ax-visually-hidden">Modifier</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="ax-table__row">
                    <td className="ax-table__td">
                      <div
                        className="ax-cluster"
                        style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}
                      >
                        <AvatarChip name={row.user_display_name} seed={row.user} />
                        <span
                          style={{ fontWeight: 500, color: 'var(--ax-text-strong)', minWidth: 0 }}
                        >
                          {row.user_display_name}
                        </span>
                      </div>
                    </td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                      {row.department_name ?? '—'}
                    </td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                      {row.job_title_name ?? '—'}
                    </td>
                    <td
                      className="ax-table__td"
                      style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}
                    >
                      {formatDate(row.hired_at)}
                    </td>
                    <td className="ax-table__td">
                      {row.is_running ? (
                        <StatusBadge tone="success" label="Dans l’équipe" />
                      ) : (
                        <div
                          className="ax-cluster"
                          style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}
                        >
                          <StatusBadge tone="neutral" label="Dossier clos" />
                          {row.ended_at !== null && (
                            <span
                              style={{
                                fontSize: 'var(--ax-text-xs)',
                                color: 'var(--ax-text-muted)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              le {formatDate(row.ended_at)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="ax-table__td" style={{ textAlign: 'end' }}>
                      <button
                        type="button"
                        className="ax-btn ax-btn--ghost ax-btn--sm"
                        onClick={() => setModal({ employment: row })}
                      >
                        <IconEdit />
                        <span className="ax-btn__label">Modifier</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal && (
        <EmploymentModal
          employment={modal.employment}
          taken={taken}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            employments.reload();
            all.reload();
          }}
        />
      )}
    </>
  );
}

export default HrEmployments;
