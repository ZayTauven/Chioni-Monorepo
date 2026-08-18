'use client';
/*
 * Chioni — /centre/patients : registre des patients du centre.
 *
 * Base Vireo : la table de apps/Contacts + DataTables (recherche, pagination).
 * Recherche SERVEUR (`?q=` sur nom/téléphone, debounce 400 ms), pagination
 * serveur, badges claim_status FR, création guichet (porte C) en modal avec la
 * section repliable « Proche à l'étranger » (guardian_phone + relation).
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  createPatient,
  listPatients,
  listSimilarPatients,
  type CenterPatientPayload,
  type SimilarPatientsQuery,
} from '@/lib/endpoints/centers';
import { CLAIM_STATUS_LABELS, RELATIONSHIP_LABELS, SEX_LABELS, formatDate } from '@/lib/labels';
import type { Relationship, Sex } from '@/lib/types';
import {
  AvatarChip,
  CLAIM_TONES,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconChevronRight,
  IconPlus,
  IconSearch,
  Modal,
  Pagination,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
  useDebounced,
} from './shared';

interface PatientForm {
  first_name: string;
  last_name: string;
  birth_date: string;
  sex: Sex;
  phone: string;
  city: string;
  guardian_phone: string;
  guardian_relationship: Relationship | '';
}

const EMPTY_FORM: PatientForm = {
  first_name: '',
  last_name: '',
  birth_date: '',
  sex: '',
  phone: '',
  city: '',
  guardian_phone: '',
  guardian_relationship: '',
};

function CreatePatientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { centerId } = useCenter();
  const [form, setForm] = useState<PatientForm>(EMPTY_FORM);
  const [guardianOpen, setGuardianOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const set = <K extends keyof PatientForm>(key: K, value: PatientForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /* S3 — détection de doublons, NON bloquante par conception : dès que
     téléphone OU nom+date de naissance sont posés (debounce), `similar/`
     est interrogé et un bandeau informe le guichet — qui décide. Une
     erreur pendant la frappe (téléphone incomplet → 400) reste muette. */
  const similarKey = useDebounced(
    [form.phone.trim(), form.last_name.trim(), form.first_name.trim(), form.birth_date].join('|'),
    500,
  );
  const similar = useAsync(() => {
    const [phone, lastName, firstName, birthDate] = similarKey.split('|');
    const query: SimilarPatientsQuery = {};
    if (/^\+?\d{6,}$/.test(phone.replace(/[\s.\-()]/g, ''))) query.phone = phone;
    if (lastName && birthDate) {
      query.last_name = lastName;
      query.birth_date = birthDate;
      if (firstName) query.first_name = firstName;
    }
    if (!query.phone && !query.last_name) return Promise.resolve(null);
    return listSimilarPatients(centerId, query).catch(() => null);
  }, [centerId, similarKey]);
  const lookalikes = similar.data?.results ?? [];

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: CenterPatientPayload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
    };
    if (form.birth_date) payload.birth_date = form.birth_date;
    if (form.sex) payload.sex = form.sex;
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.city.trim()) payload.city = form.city.trim();
    if (form.guardian_phone.trim()) {
      payload.guardian_phone = form.guardian_phone.trim();
      if (form.guardian_relationship) payload.guardian_relationship = form.guardian_relationship;
    }
    try {
      const patient = await createPatient(centerId, payload);
      onCreated(patient.id);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nouveau patient"
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" form="patient-create-form" className="ax-btn ax-btn--primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer le patient'}
          </button>
        </>
      }
    >
      <form
        id="patient-create-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {/* auto-fit : sur un écran étroit (tablette de guichet), la grille
            retombe en une colonne au lieu d'écraser les champs. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="np-first">
              Prénom <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="np-first"
              type="text"
              className={`ax-input${error?.fieldErrors.first_name ? ' is-invalid' : ''}`}
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)}
              required
            />
            <FieldError error={error} field="first_name" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="np-last">
              Nom <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="np-last"
              type="text"
              className={`ax-input${error?.fieldErrors.last_name ? ' is-invalid' : ''}`}
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
              required
            />
            <FieldError error={error} field="last_name" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="np-birth">Date de naissance</label>
            <input
              id="np-birth"
              type="date"
              className={`ax-input${error?.fieldErrors.birth_date ? ' is-invalid' : ''}`}
              value={form.birth_date}
              onChange={(e) => set('birth_date', e.target.value)}
            />
            <FieldError error={error} field="birth_date" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="np-sex">Sexe</label>
            <select id="np-sex" className="ax-select" value={form.sex} onChange={(e) => set('sex', e.target.value as Sex)}>
              <option value="">{SEX_LABELS['']}</option>
              <option value="f">{SEX_LABELS.f}</option>
              <option value="m">{SEX_LABELS.m}</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="np-phone">Téléphone</label>
            <input
              id="np-phone"
              type="tel"
              className={`ax-input${error?.fieldErrors.phone ? ' is-invalid' : ''}`}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+269…"
            />
            <FieldError error={error} field="phone" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="np-city">Ville</label>
            <input id="np-city" type="text" className="ax-input" value={form.city} onChange={(e) => set('city', e.target.value)} />
            <FieldError error={error} field="city" />
          </div>
        </div>

        {/* S3 — bandeau doublons : informe, ne bloque jamais la création. */}
        {lookalikes.length > 0 && (
          <div className="ax-alert ax-alert--warning" role="status">
            <div className="ax-alert__content">
              <p className="ax-alert__title">Des dossiers ressemblants existent</p>
              <p className="ax-alert__message">
                Vérifiez avant de créer un doublon : ouvrez une fiche existante, ou continuez la
                création si c&apos;est bien une autre personne.
              </p>
              <ul style={{ margin: 'var(--ax-space-2) 0 0', paddingInlineStart: 'var(--ax-space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                {lookalikes.slice(0, 5).map((p) => (
                  <li key={p.id} style={{ fontSize: 'var(--ax-text-sm)' }}>
                    <Link href={`/centre/patients/${p.id}`} className="ax-link" style={{ fontWeight: 500 }}>
                      {`${p.first_name} ${p.last_name}`.trim()}
                    </Link>{' '}
                    <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>
                      {p.birth_date ? formatDate(p.birth_date) : 'Naissance inconnue'} · {p.phone || 'Sans téléphone'} · {CLAIM_STATUS_LABELS[p.claim_status]}
                    </span>
                  </li>
                ))}
                {lookalikes.length > 5 && (
                  <li style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', listStyle: 'none' }}>
                    … et {lookalikes.length - 5} autre{lookalikes.length - 5 > 1 ? 's' : ''} — affinez le nom ou le téléphone.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
          <button
            type="button"
            className="ax-btn ax-btn--ghost ax-btn--block"
            onClick={() => setGuardianOpen((o) => !o)}
            aria-expanded={guardianOpen}
            style={{ justifyContent: 'space-between' }}
          >
            <span className="ax-btn__label">Proche à l&apos;étranger (facultatif)</span>
            <span style={{ transform: guardianOpen ? 'rotate(90deg)' : 'none', transition: 'transform var(--ax-motion-base)', display: 'inline-flex' }}>
              <IconChevronRight />
            </span>
          </button>
          {guardianOpen && (
            <div style={{ padding: '0 var(--ax-space-4) var(--ax-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                Une invitation sera envoyée par SMS à ce proche pour l&apos;aider à suivre et payer les soins du patient.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="np-gphone">Téléphone du proche</label>
                  <input
                    id="np-gphone"
                    type="tel"
                    className={`ax-input${error?.fieldErrors.guardian_phone ? ' is-invalid' : ''}`}
                    value={form.guardian_phone}
                    onChange={(e) => set('guardian_phone', e.target.value)}
                    placeholder="+33…"
                  />
                  <FieldError error={error} field="guardian_phone" />
                </div>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="np-grel">Lien avec le patient</label>
                  <select
                    id="np-grel"
                    className="ax-select"
                    value={form.guardian_relationship}
                    onChange={(e) => set('guardian_relationship', e.target.value as Relationship | '')}
                  >
                    <option value="">Choisir…</option>
                    {(Object.keys(RELATIONSHIP_LABELS) as Relationship[]).map((r) => (
                      <option key={r} value={r}>
                        {RELATIONSHIP_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <FieldError error={error} field="guardian_relationship" />
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

export function Patients() {
  const { centerId } = useCenter();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedQ = useDebounced(q.trim());

  const patients = useAsync(
    () => listPatients(centerId, { q: debouncedQ || undefined, page }),
    [centerId, debouncedQ, page],
  );

  return (
    <>
      <PageHead
        title="Patients"
        subtitle="Registre des patients reçus par le centre."
        actions={
          <button type="button" className="ax-btn ax-btn--primary" onClick={() => setCreateOpen(true)}>
            <IconPlus />
            <span className="ax-btn__label">Nouveau patient</span>
          </button>
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Liste des patients">
          <div className="ax-card__body" style={{ paddingBottom: 'var(--ax-space-3)' }}>
            <div className="ax-field__control" style={{ maxWidth: 420 }}>
              <span className="ax-field__affix ax-field__affix--leading">
                <IconSearch className="" />
              </span>
              <input
                type="search"
                className="ax-input ax-input--sm ax-input--with-leading-icon"
                placeholder="Rechercher par nom ou téléphone…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                aria-label="Rechercher un patient"
              />
            </div>
          </div>

          {patients.loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : patients.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={patients.error} onRetry={patients.reload} />
            </div>
          ) : patients.data && patients.data.results.length === 0 ? (
            <EmptyState
              title={debouncedQ ? 'Aucun patient trouvé' : 'Aucun patient enregistré'}
              message={
                debouncedQ
                  ? `Aucun patient ne correspond à « ${debouncedQ} ». Vérifiez l'orthographe ou créez un nouveau dossier.`
                  : 'Enregistrez le premier patient du centre avec le bouton « Nouveau patient ».'
              }
              action={
                <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setCreateOpen(true)}>
                  <IconPlus />
                  <span className="ax-btn__label">Nouveau patient</span>
                </button>
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Patient</th>
                      <th className="ax-table__th" scope="col">Naissance</th>
                      <th className="ax-table__th" scope="col">Téléphone</th>
                      <th className="ax-table__th" scope="col">Ville</th>
                      <th className="ax-table__th" scope="col">Compte</th>
                      <th className="ax-table__th" scope="col"><span className="ax-visually-hidden">Ouvrir</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.data?.results.map((p) => {
                      const name = `${p.first_name} ${p.last_name}`.trim();
                      return (
                        <tr
                          key={p.id}
                          className="ax-table__row"
                          onClick={() => router.push(`/centre/patients/${p.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="ax-table__td">
                            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                              <AvatarChip name={name} seed={p.id} />
                              <div style={{ minWidth: 0 }}>
                                <Link
                                  href={`/centre/patients/${p.id}`}
                                  className="ax-link"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}
                                >
                                  {name}
                                </Link>
                                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                                  {SEX_LABELS[p.sex]}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                            {p.birth_date ? formatDate(p.birth_date) : '—'}
                          </td>
                          <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>
                            {p.phone || '—'}
                          </td>
                          <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{p.city || '—'}</td>
                          <td className="ax-table__td">
                            <StatusBadge tone={CLAIM_TONES[p.claim_status]} label={CLAIM_STATUS_LABELS[p.claim_status]} />
                          </td>
                          <td className="ax-table__td" style={{ textAlign: 'end' }}>
                            <IconChevronRight className="" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {patients.data && <Pagination count={patients.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>

      {createOpen && (
        <CreatePatientModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            router.push(`/centre/patients/${id}`);
          }}
        />
      )}
    </>
  );
}

export default Patients;
