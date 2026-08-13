'use client';
/*
 * Chioni — /centre/patients/[id] : dossier administratif d'un patient.
 *
 * - Identité : PATCH possible tant que le profil n'est pas revendiqué ; si le
 *   backend répond 400 (« profil géré par le patient »), le message est montré
 *   tel quel et l'édition se referme.
 * - Consultations : l'API ne filtre pas par patient — on filtre CÔTÉ CLIENT la
 *   liste paginée du centre, en l'assumant (bandeau « parmi les N dernières »),
 *   avec chargement progressif des pages suivantes.
 * - Fusion de doublons : le dossier courant est la CIBLE (conservé) ; le
 *   doublon absorbé est choisi par recherche. Avertissement explicite.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  getPatient,
  listEncounters,
  listPatients,
  mergePatients,
  updatePatient,
  type EncounterStaff,
} from '@/lib/endpoints/centers';
import {
  CLAIM_STATUS_LABELS,
  ENCOUNTER_STATUS_LABELS,
  SEX_LABELS,
  formatDate,
  formatDateTime,
} from '@/lib/labels';
import type { Paginated, Patient, Sex } from '@/lib/types';
import {
  AvatarChip,
  CLAIM_TONES,
  CardSkeleton,
  DetailItem,
  EmptyState,
  ENCOUNTER_TONES,
  ErrorAlert,
  FieldError,
  IconArrowLeft,
  IconEdit,
  IconMerge,
  IconSearch,
  Modal,
  PAGE_SIZE,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
  useDebounced,
} from './shared';

/* ── identity edit form ── */

function IdentityForm({
  patient,
  onCancel,
  onSaved,
}: {
  patient: Patient;
  onCancel: () => void;
  onSaved: (fresh: Patient) => void;
}) {
  const { centerId } = useCenter();
  const [form, setForm] = useState({
    first_name: patient.first_name,
    last_name: patient.last_name,
    birth_date: patient.birth_date ?? '',
    sex: patient.sex,
    phone: patient.phone ?? '',
    city: patient.city,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await updatePatient(centerId, patient.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        birth_date: form.birth_date || null,
        sex: form.sex,
        phone: form.phone.trim() || null,
        city: form.city.trim(),
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pe-first">Prénom</label>
          <input
            id="pe-first"
            type="text"
            className={`ax-input${error?.fieldErrors.first_name ? ' is-invalid' : ''}`}
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            required
          />
          <FieldError error={error} field="first_name" />
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pe-last">Nom</label>
          <input
            id="pe-last"
            type="text"
            className={`ax-input${error?.fieldErrors.last_name ? ' is-invalid' : ''}`}
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            required
          />
          <FieldError error={error} field="last_name" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pe-birth">Date de naissance</label>
          <input
            id="pe-birth"
            type="date"
            className={`ax-input${error?.fieldErrors.birth_date ? ' is-invalid' : ''}`}
            value={form.birth_date}
            onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
          />
          <FieldError error={error} field="birth_date" />
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pe-sex">Sexe</label>
          <select id="pe-sex" className="ax-select" value={form.sex} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value as Sex }))}>
            <option value="">{SEX_LABELS['']}</option>
            <option value="f">{SEX_LABELS.f}</option>
            <option value="m">{SEX_LABELS.m}</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pe-phone">Téléphone</label>
          <input
            id="pe-phone"
            type="tel"
            className={`ax-input${error?.fieldErrors.phone ? ' is-invalid' : ''}`}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+269…"
          />
          <FieldError error={error} field="phone" />
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pe-city">Ville</label>
          <input id="pe-city" type="text" className="ax-input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          <FieldError error={error} field="city" />
        </div>
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

/* ── merge modal ── */

function MergeModal({
  target,
  onClose,
  onMerged,
}: {
  target: Patient;
  onClose: () => void;
  onMerged: () => void;
}) {
  const { centerId } = useCenter();
  const [q, setQ] = useState('');
  const [source, setSource] = useState<Patient | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const debouncedQ = useDebounced(q.trim());

  const candidates = useAsync(
    () => (debouncedQ ? listPatients(centerId, { q: debouncedQ, page: 1 }) : Promise.resolve(null)),
    [centerId, debouncedQ],
  );
  const results = (candidates.data?.results ?? []).filter((p) => p.id !== target.id);

  const submit = async () => {
    if (!source) return;
    setMerging(true);
    setError(null);
    try {
      await mergePatients(centerId, source.id, target.id);
      onMerged();
    } catch (err) {
      setError(toApiError(err));
      setMerging(false);
    }
  };

  return (
    <Modal
      title="Fusionner un doublon"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={merging}>
            Annuler
          </button>
          <button type="button" className="ax-btn ax-btn--primary" onClick={() => void submit()} disabled={!source || merging}>
            {merging ? 'Fusion…' : 'Fusionner les dossiers'}
          </button>
        </>
      }
    >
      <div className="ax-alert ax-alert--warning" role="alert">
        <div className="ax-alert__content">
          <p className="ax-alert__title">Action définitive</p>
          <p className="ax-alert__message">
            Le dossier en doublon sera absorbé dans le dossier de{' '}
            <b>{target.first_name} {target.last_name}</b> (conservé). Les consultations et liens du doublon sont
            transférés ; cette fusion ne peut pas être annulée. Si le patient a activé son compte,
            il devra confirmer lui-même les tuteurs transférés.
          </p>
        </div>
      </div>

      {error && <ErrorAlert error={error} />}

      <div className="ax-field">
        <label className="ax-label" htmlFor="merge-q">Rechercher le dossier en doublon à absorber</label>
        <div className="ax-field__control">
          <span className="ax-field__affix ax-field__affix--leading">
            <IconSearch className="" />
          </span>
          <input
            id="merge-q"
            type="search"
            className="ax-input ax-input--with-leading-icon"
            placeholder="Nom ou téléphone…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSource(null);
            }}
          />
        </div>
      </div>

      {debouncedQ && candidates.loading && <CardSkeleton lines={3} />}
      {debouncedQ && !candidates.loading && results.length === 0 && (
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
          Aucun autre dossier ne correspond à cette recherche.
        </p>
      )}
      {results.length > 0 && (
        <ul className="ax-list ax-list--compact" role="listbox" aria-label="Dossiers candidats">
          {results.map((p) => (
            <li key={p.id} className="ax-list__row">
              <span className="ax-list__leading">
                <input
                  type="radio"
                  name="merge-source"
                  className="ax-radio"
                  checked={source?.id === p.id}
                  onChange={() => setSource(p)}
                  aria-label={`Absorber ${p.first_name} ${p.last_name}`}
                />
              </span>
              <span className="ax-list__content">
                <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                  {p.first_name} {p.last_name}
                </span>
                <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                  {p.birth_date ? formatDate(p.birth_date) : 'Naissance inconnue'} · {p.phone || 'Sans téléphone'}
                </span>
              </span>
              <span className="ax-list__trailing">
                <StatusBadge tone={CLAIM_TONES[p.claim_status]} label={CLAIM_STATUS_LABELS[p.claim_status]} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ── screen ── */

export function PatientDetail({ patientId }: { patientId: number }) {
  const { centerId } = useCenter();
  const [editing, setEditing] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [patched, setPatched] = useState<Patient | null>(null);

  const patientState = useAsync(() => getPatient(centerId, patientId), [centerId, patientId]);
  const patient = patched ?? patientState.data;

  // Encounters of the center, filtered client-side on this patient.
  const [pagesLoaded, setPagesLoaded] = useState(1);
  const [extraPages, setExtraPages] = useState<EncounterStaff[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const firstPage = useAsync(() => listEncounters(centerId, 1), [centerId]);

  const allEncounters = useMemo(
    () => [...(firstPage.data?.results ?? []), ...extraPages],
    [firstPage.data, extraPages],
  );
  const patientEncounters = allEncounters.filter((e) => e.patient === patientId);
  const totalCount = firstPage.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const scanned = Math.min(totalCount, pagesLoaded * PAGE_SIZE);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next: Paginated<EncounterStaff> = await listEncounters(centerId, pagesLoaded + 1);
      setExtraPages((prev) => [...prev, ...next.results]);
      setPagesLoaded((p) => p + 1);
    } catch {
      /* le bouton reste disponible pour réessayer */
    } finally {
      setLoadingMore(false);
    }
  };

  if (patientState.loading) {
    return (
      <>
        <PageHead title="Dossier patient" />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--4"><CardSkeleton lines={6} /></section>
          <section className="ax-card ax-col--8"><TableSkeleton rows={4} cols={3} /></section>
        </div>
      </>
    );
  }

  if (patientState.error || !patient) {
    return (
      <>
        <PageHead title="Dossier patient" />
        <div className="ax-dash-grid">
          <div className="ax-col--12">
            <ErrorAlert
              error={patientState.error ?? toApiError(null)}
              onRetry={patientState.reload}
            />
            <p style={{ marginTop: 'var(--ax-space-4)' }}>
              <Link href="/centre/patients" className="ax-btn ax-btn--secondary">
                <IconArrowLeft />
                <span className="ax-btn__label">Retour aux patients</span>
              </Link>
            </p>
          </div>
        </div>
      </>
    );
  }

  const name = `${patient.first_name} ${patient.last_name}`.trim();
  const claimed = patient.claim_status === 'actif';

  return (
    <>
      <PageHead
        title={name}
        subtitle="Dossier administratif du patient dans ce centre."
        actions={
          <>
            <Link href="/centre/patients" className="ax-btn ax-btn--secondary">
              <IconArrowLeft />
              <span className="ax-btn__label">Retour</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setMergeOpen(true)}>
              <IconMerge />
              <span className="ax-btn__label">Fusionner un doublon</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Identity */}
        <section className="ax-card ax-col--4" role="region" aria-label="Identité">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Identité</h2>
            </div>
            {!editing && !claimed && (
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setEditing(true)}>
                <IconEdit />
                <span className="ax-btn__label">Modifier</span>
              </button>
            )}
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <AvatarChip name={name} seed={patient.id} size="md" />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--ax-text-strong)' }}>{name}</div>
                <StatusBadge tone={CLAIM_TONES[patient.claim_status]} label={CLAIM_STATUS_LABELS[patient.claim_status]} />
              </div>
            </div>

            {claimed && (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                Ce patient a activé son compte : lui seul peut modifier son identité, depuis son espace.
              </p>
            )}

            {editing ? (
              <IdentityForm
                patient={patient}
                onCancel={() => setEditing(false)}
                onSaved={(fresh) => {
                  setPatched(fresh);
                  setEditing(false);
                }}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                <DetailItem label="Date de naissance">{patient.birth_date ? formatDate(patient.birth_date) : '—'}</DetailItem>
                <DetailItem label="Sexe">{SEX_LABELS[patient.sex]}</DetailItem>
                <DetailItem label="Téléphone">{patient.phone || '—'}</DetailItem>
                <DetailItem label="Ville">{patient.city || '—'}</DetailItem>
                <DetailItem label="Dossier créé le">{formatDate(patient.created_at)}</DetailItem>
              </div>
            )}
          </div>
        </section>

        {/* Encounters at this center */}
        <section className="ax-card ax-col--8" role="region" aria-label="Consultations au centre">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Consultations dans ce centre</h2>
              {totalCount > PAGE_SIZE && (
                <p className="ax-card__subtitle">
                  Recherche parmi les {scanned} consultations les plus récentes du centre (sur {totalCount}).
                </p>
              )}
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {firstPage.loading ? (
              <TableSkeleton rows={4} cols={3} />
            ) : firstPage.error ? (
              <ErrorAlert error={firstPage.error} onRetry={firstPage.reload} />
            ) : patientEncounters.length === 0 ? (
              <EmptyState
                title="Aucune consultation trouvée"
                message={
                  pagesLoaded < totalPages
                    ? 'Aucune consultation de ce patient dans les pages déjà chargées. Vous pouvez charger la suite de l’historique.'
                    : 'Ce patient n’a pas encore de consultation enregistrée dans ce centre.'
                }
                action={
                  pagesLoaded < totalPages ? (
                    <button type="button" className="ax-btn ax-btn--secondary" onClick={() => void loadMore()} disabled={loadingMore}>
                      {loadingMore ? 'Chargement…' : 'Charger plus d’historique'}
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <ul className="ax-list ax-list--compact">
                  {patientEncounters.map((e) => (
                    <li key={e.id} className="ax-list__row">
                      <span className="ax-list__content">
                        <Link href={`/centre/consultations/${e.id}`} className="ax-link ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                          {e.reason ?? `Consultation n° ${e.id}`}
                        </Link>
                        <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                          {formatDateTime(e.occurred_at)} · {e.practitioner_name} · {e.acts.length} acte{e.acts.length > 1 ? 's' : ''}
                        </span>
                      </span>
                      <span className="ax-list__trailing">
                        <StatusBadge tone={ENCOUNTER_TONES[e.status]} label={ENCOUNTER_STATUS_LABELS[e.status]} />
                      </span>
                    </li>
                  ))}
                </ul>
                {pagesLoaded < totalPages && (
                  <div style={{ textAlign: 'center', marginTop: 'var(--ax-space-4)' }}>
                    <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => void loadMore()} disabled={loadingMore}>
                      {loadingMore ? 'Chargement…' : 'Charger plus d’historique'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {mergeOpen && (
        <MergeModal
          target={patient}
          onClose={() => setMergeOpen(false)}
          onMerged={() => {
            setMergeOpen(false);
            setPatched(null);
            patientState.reload();
            firstPage.reload();
            setExtraPages([]);
            setPagesLoaded(1);
          }}
        />
      )}
    </>
  );
}

export default PatientDetail;
