'use client';
/*
 * Chioni — /plateforme : registre des centres de santé (S4, ADR 0017).
 *
 * Base Vireo réutilisée telle quelle : la table de `apps/Contacts` +
 * `DataTables` déjà adaptée en `centre/Patients.tsx` (recherche serveur avec
 * debounce, filtre, pagination serveur, création en modale, bandeau de
 * similitude non bloquant). Le back-office gouverne des TENANTS : aucun
 * patient ne traverse ces payloads.
 *
 * Deux points produit portés par cet écran :
 * 1. la création n'est montée que pour un `admin` (un `support` lit) ;
 * 2. le premier directeur naît en COMPTE OMBRE — aucun mot de passe n'est
 *    transmis, il prend son compte par SMS. L'UI le dit, et ne promet
 *    jamais d'identifiants.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import type { ApiError } from '@/lib/api';
import {
  createPlatformCenter,
  listPlatformCenters,
  listSimilarCenters,
  type PlatformCenterPayload,
  type SimilarCentersQuery,
} from '@/lib/endpoints/platform';
import {
  CENTER_TYPE_LABELS,
  ISLAND_LABELS,
  KYC_STATUS_LABELS,
  SHADOW_ACCOUNT_NOTICE,
  formatDate,
} from '@/lib/labels';
import type { CenterType, Island, KycStatus, PlatformCenter } from '@/lib/types';
import {
  AvatarChip,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconChevronRight,
  IconPlus,
  IconSearch,
  KYC_TONES,
  Modal,
  Pagination,
  ReadOnlyNotice,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
  useDebounced,
  usePlatformRole,
} from './shared';

interface CenterForm {
  name: string;
  type: CenterType;
  island: Island;
  city: string;
  address: string;
  phone: string;
  email: string;
  director_phone: string;
  director_first_name: string;
  director_last_name: string;
}

const EMPTY_FORM: CenterForm = {
  name: '',
  type: 'centre_sante',
  island: 'ngazidja',
  city: '',
  address: '',
  phone: '',
  email: '',
  director_phone: '',
  director_first_name: '',
  director_last_name: '',
};

const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 'var(--ax-space-4)',
} as const;

/**
 * SV — `/platform/centers/` expose enfin `logo` (URL absolue ou null) : la
 * vraie image quand elle existe, la pastille d'initiales sinon (patron
 * `MemberAvatar` de l'écran Personnel du centre).
 */
function CenterLogo({ center }: { center: PlatformCenter }) {
  if (center.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL média de l'API, aucun loader Next configuré
      <img
        src={center.logo}
        alt=""
        width={32}
        height={32}
        style={{ width: 32, height: 32, borderRadius: 'var(--ax-radius-sm)', objectFit: 'cover', flex: '0 0 auto' }}
      />
    );
  }
  return <AvatarChip name={center.name} seed={center.id} />;
}

/* ── création d'un centre + son premier directeur ── */

function CreateCenterModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [form, setForm] = useState<CenterForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const set = <K extends keyof CenterForm>(key: K, value: CenterForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /* Détection de similitude, NON bloquante par conception (miroir exact de la
     porte C patient de S3) : aucune contrainte d'unicité n'existe sur le nom
     d'un centre — deux « Clinique El-Maarouf » peuvent coexister sur deux
     îles. On informe AVANT, on ne bloque jamais APRÈS. Une erreur pendant la
     frappe (aucun critère utilisable → 400) reste muette. */
  const similarKey = useDebounced([form.name.trim(), form.city.trim()].join('|'), 500);
  const similar = useAsync(() => {
    const [name, city] = similarKey.split('|');
    if (name.length < 3 && city.length < 3) return Promise.resolve(null);
    // Volontairement SANS filtre d'île : un doublon sur une autre île doit
    // rester visible — c'est l'exploitant qui tranche, et chaque ligne du
    // bandeau affiche son île pour qu'il puisse le faire.
    const query: SimilarCentersQuery = {};
    if (name) query.name = name;
    if (city) query.city = city;
    return listSimilarCenters(query).catch(() => null);
  }, [similarKey]);
  const lookalikes = similar.data?.results ?? [];

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: PlatformCenterPayload = {
      name: form.name.trim(),
      type: form.type,
      island: form.island,
      city: form.city.trim(),
      director_phone: form.director_phone.trim(),
    };
    if (form.address.trim()) payload.address = form.address.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.director_first_name.trim()) payload.director_first_name = form.director_first_name.trim();
    if (form.director_last_name.trim()) payload.director_last_name = form.director_last_name.trim();
    try {
      const created = await createPlatformCenter(payload);
      onCreated(created.id);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nouveau centre de santé"
      onClose={onClose}
      width={620}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="platform-center-form"
            className="ax-btn ax-btn--primary"
            disabled={saving}
          >
            {saving ? 'Création…' : 'Créer le centre'}
          </button>
        </>
      }
    >
      <form
        id="platform-center-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <div className="ax-field">
          <label className="ax-label" htmlFor="pc-name">
            Nom du centre <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="pc-name"
            type="text"
            className={`ax-input${error?.fieldErrors.name ? ' is-invalid' : ''}`}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
            data-autofocus=""
          />
          <FieldError error={error} field="name" />
        </div>

        <div style={GRID}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pc-type">
              Type <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <select
              id="pc-type"
              className="ax-select"
              value={form.type}
              onChange={(e) => set('type', e.target.value as CenterType)}
            >
              {(Object.keys(CENTER_TYPE_LABELS) as CenterType[]).map((t) => (
                <option key={t} value={t}>
                  {CENTER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <FieldError error={error} field="type" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pc-island">
              Île <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <select
              id="pc-island"
              className="ax-select"
              value={form.island}
              onChange={(e) => set('island', e.target.value as Island)}
            >
              {(Object.keys(ISLAND_LABELS) as Island[]).map((i) => (
                <option key={i} value={i}>
                  {ISLAND_LABELS[i]}
                </option>
              ))}
            </select>
            <FieldError error={error} field="island" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pc-city">
              Ville <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="pc-city"
              type="text"
              className={`ax-input${error?.fieldErrors.city ? ' is-invalid' : ''}`}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              required
            />
            <FieldError error={error} field="city" />
          </div>
        </div>

        {/* Bandeau de similitude — informe, ne bloque jamais la création. */}
        {lookalikes.length > 0 && (
          <div className="ax-alert ax-alert--warning" role="status">
            <div className="ax-alert__content">
              <p className="ax-alert__title">Des centres ressemblants existent déjà</p>
              <p className="ax-alert__message">
                Vérifiez avant de créer un doublon — ou continuez, si c&apos;est bien un autre
                établissement (deux centres peuvent porter le même nom sur deux îles).
              </p>
              <ul style={{ margin: 'var(--ax-space-2) 0 0', paddingInlineStart: 'var(--ax-space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                {lookalikes.slice(0, 5).map((c) => (
                  <li key={c.id} style={{ fontSize: 'var(--ax-text-sm)' }}>
                    <Link href={`/plateforme/centres/${c.id}`} className="ax-link" style={{ fontWeight: 500 }}>
                      {c.name}
                    </Link>{' '}
                    <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>
                      {c.city || 'Ville non renseignée'} · {ISLAND_LABELS[c.island]} ·{' '}
                      {KYC_STATUS_LABELS[c.kyc_status]}
                    </span>
                  </li>
                ))}
                {lookalikes.length > 5 && (
                  <li style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', listStyle: 'none' }}>
                    … et {lookalikes.length - 5} autre{lookalikes.length - 5 > 1 ? 's' : ''} — affinez le
                    nom ou la ville.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        <div style={GRID}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pc-phone">Téléphone du centre</label>
            <input
              id="pc-phone"
              type="tel"
              className={`ax-input${error?.fieldErrors.phone ? ' is-invalid' : ''}`}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+269…"
            />
            <FieldError error={error} field="phone" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pc-email">E-mail du centre</label>
            <input
              id="pc-email"
              type="email"
              className={`ax-input${error?.fieldErrors.email ? ' is-invalid' : ''}`}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
            <FieldError error={error} field="email" />
          </div>
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="pc-address">Adresse</label>
          <input
            id="pc-address"
            type="text"
            className="ax-input"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
          <FieldError error={error} field="address" />
        </div>

        {/* ── le premier directeur ── */}
        <div
          style={{
            border: '1px solid var(--ax-border)',
            borderRadius: 'var(--ax-radius-md)',
            padding: 'var(--ax-space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ax-space-4)',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--ax-font-display)',
                fontSize: 'var(--ax-text-sm)',
                fontWeight: 'var(--ax-weight-semibold)',
                color: 'var(--ax-text-strong)',
              }}
            >
              Premier directeur
            </h3>
            <p style={{ margin: 'var(--ax-space-1) 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
              {SHADOW_ACCOUNT_NOTICE}
            </p>
          </div>
          <div style={GRID}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="pc-dphone">
                Téléphone du directeur <span className="ax-field__required" aria-hidden="true">*</span>
              </label>
              <input
                id="pc-dphone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                className={`ax-input${error?.fieldErrors.director_phone ? ' is-invalid' : ''}`}
                value={form.director_phone}
                onChange={(e) => set('director_phone', e.target.value)}
                placeholder="+269…"
                required
              />
              <FieldError error={error} field="director_phone" />
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="pc-dfirst">Prénom</label>
              <input
                id="pc-dfirst"
                type="text"
                className="ax-input"
                value={form.director_first_name}
                onChange={(e) => set('director_first_name', e.target.value)}
              />
              <FieldError error={error} field="director_first_name" />
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="pc-dlast">Nom</label>
              <input
                id="pc-dlast"
                type="text"
                className="ax-input"
                value={form.director_last_name}
                onChange={(e) => set('director_last_name', e.target.value)}
              />
              <FieldError error={error} field="director_last_name" />
            </div>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
          Le centre naît toujours <b>en attente de vérification</b>&nbsp;: il pourra soigner,
          facturer et encaisser au guichet dès le premier jour, mais le Pont de Confiance ne
          s&apos;ouvrira qu&apos;après votre décision sur sa fiche.
        </p>
      </form>
    </Modal>
  );
}

/* ── écran ── */

const KYC_FILTERS: Array<{ value: '' | KycStatus; label: string }> = [
  { value: '', label: 'Tous les statuts' },
  { value: 'en_attente', label: KYC_STATUS_LABELS.en_attente },
  { value: 'actif', label: KYC_STATUS_LABELS.actif },
  { value: 'suspendu', label: KYC_STATUS_LABELS.suspendu },
];

export function PlatformCenters() {
  const router = useRouter();
  const { canWrite } = usePlatformRole();
  const [q, setQ] = useState('');
  const [kyc, setKyc] = useState<'' | KycStatus>('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedQ = useDebounced(q.trim());

  const centers = useAsync(
    () =>
      listPlatformCenters({
        q: debouncedQ || undefined,
        kyc_status: kyc || undefined,
        page,
      }),
    [debouncedQ, kyc, page],
  );

  const rows = centers.data?.results ?? [];

  return (
    <>
      <PlatformPageHead
        title="Centres de santé"
        subtitle="Les établissements clients de Chioni, leur vérification et leur encadrement."
        actions={
          canWrite ? (
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setCreateOpen(true)}>
              <IconPlus />
              <span className="ax-btn__label">Nouveau centre</span>
            </button>
          ) : undefined
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Liste des centres">
          <div className="ax-card__body" style={{ paddingBottom: 'var(--ax-space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
              <div className="ax-field__control" style={{ maxWidth: 380, flex: '1 1 240px' }}>
                <span className="ax-field__affix ax-field__affix--leading">
                  <IconSearch className="" />
                </span>
                <input
                  type="search"
                  className="ax-input ax-input--sm ax-input--with-leading-icon"
                  placeholder="Rechercher par nom ou ville…"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Rechercher un centre"
                />
              </div>
              <div className="ax-field" style={{ minWidth: 200 }}>
                <label className="ax-visually-hidden" htmlFor="pc-filter-kyc">
                  Filtrer par statut de vérification
                </label>
                <select
                  id="pc-filter-kyc"
                  className="ax-select ax-select--sm"
                  value={kyc}
                  onChange={(e) => {
                    setKyc(e.target.value as '' | KycStatus);
                    setPage(1);
                  }}
                >
                  {KYC_FILTERS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!canWrite && <ReadOnlyNotice />}
          </div>

          {centers.loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : centers.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={centers.error} onRetry={centers.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title={debouncedQ || kyc ? 'Aucun centre ne correspond' : 'Aucun centre pour l’instant'}
              message={
                debouncedQ || kyc
                  ? 'Modifiez la recherche ou le filtre de vérification pour élargir la liste.'
                  : 'Les centres de santé clients de Chioni apparaîtront ici dès le premier onboarding.'
              }
              action={
                canWrite ? (
                  <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setCreateOpen(true)}>
                    <IconPlus />
                    <span className="ax-btn__label">Nouveau centre</span>
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Centre</th>
                      <th className="ax-table__th" scope="col">Île</th>
                      <th className="ax-table__th" scope="col">Vérification</th>
                      <th className="ax-table__th" scope="col">Personnel</th>
                      <th className="ax-table__th" scope="col">Pièces</th>
                      <th className="ax-table__th" scope="col">Inscrit le</th>
                      <th className="ax-table__th" scope="col">
                        <span className="ax-visually-hidden">Ouvrir</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr
                        key={c.id}
                        className="ax-table__row"
                        onClick={() => router.push(`/plateforme/centres/${c.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="ax-table__td">
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                            <CenterLogo center={c} />
                            <div>
                              <Link
                                href={`/plateforme/centres/${c.id}`}
                                className="ax-link"
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}
                              >
                                {c.name}
                              </Link>
                              <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                                {CENTER_TYPE_LABELS[c.type]}
                                {c.city ? ` · ${c.city}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {ISLAND_LABELS[c.island]}
                        </td>
                        <td className="ax-table__td">
                          <StatusBadge tone={KYC_TONES[c.kyc_status]} label={KYC_STATUS_LABELS[c.kyc_status]} />
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {c.staff_active_count}
                          {c.director_active_count === 0 && (
                            <span
                              className="ax-badge ax-badge--soft ax-badge--danger ax-badge--pill"
                              style={{ marginInlineStart: 'var(--ax-space-2)' }}
                            >
                              Sans directeur
                            </span>
                          )}
                        </td>
                        <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>
                          {c.kyc_document_count}
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {formatDate(c.created_at)}
                        </td>
                        <td className="ax-table__td" style={{ textAlign: 'end' }}>
                          <IconChevronRight className="" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {centers.data && <Pagination count={centers.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>

      {createOpen && canWrite && (
        <CreateCenterModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            router.push(`/plateforme/centres/${id}`);
          }}
        />
      )}
    </>
  );
}

export default PlatformCenters;
