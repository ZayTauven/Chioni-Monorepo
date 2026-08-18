'use client';
/*
 * Chioni — /plateforme/pharmacies : le réseau des officines (S9, ADR 0022).
 *
 * Miroir exact de l'écran « Centres » de S4, et pour cause : une pharmacie
 * entre dans Chioni **par la plateforme**, comme un centre — le self-service
 * n'existe pas, et l'écran le dit plutôt que de laisser chercher un bouton
 * d'inscription publique.
 *
 * Deux choses seulement se passent ici : on enregistre une officine (avec sa
 * première personne, en une transaction — une pharmacie sans personne est une
 * boîte de réception morte), et on suit son état. **La décision de validation,
 * elle, vit sur la fiche** : elle demande d'avoir lu les pièces, et un bouton
 * de liste inviterait à valider au jugé.
 *
 * `admin` seul écrit ; le `support` lit — et les commandes d'écriture ne sont
 * **pas montées** pour lui (patron `usePlatformRole().canWrite` de S4 : un
 * back-office qui offre des actions qu'il refusera apprend à s'en méfier).
 *
 * Invariant `/platform/` intact : aucun patient, et ici pas davantage de
 * médicament — superviser des officines n'est pas lire les ordonnances du pays.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import type { ApiError } from '@/lib/api';
import {
  createPlatformPharmacy,
  listPlatformPharmacies,
  listSimilarPharmacies,
} from '@/lib/endpoints/pharmacy';
import {
  ISLAND_LABELS,
  PHARMACY_ADDRESS_LABEL,
  PHARMACY_CITY_LABEL,
  PHARMACY_EMAIL_LABEL,
  PHARMACY_ISLAND_LABEL,
  PHARMACY_NAME_LABEL,
  PHARMACY_PHONE_LABEL,
  PHARMACY_STATUSES,
  PHARMACY_STATUS_LABELS,
  PLATFORM_PHARMACIES_EMPTY_MESSAGE,
  PLATFORM_PHARMACIES_EMPTY_TITLE,
  PLATFORM_PHARMACIES_FILTER_EMPTY_MESSAGE,
  PLATFORM_PHARMACIES_FILTER_EMPTY_TITLE,
  PLATFORM_PHARMACIES_SUBTITLE,
  PLATFORM_PHARMACIES_TITLE,
  PLATFORM_PHARMACY_COL_DOCS,
  PLATFORM_PHARMACY_COL_MEMBERS,
  PLATFORM_PHARMACY_COL_NAME,
  PLATFORM_PHARMACY_COL_STATUS,
  PLATFORM_PHARMACY_COL_ZONE,
  PLATFORM_PHARMACY_CREATE,
  PLATFORM_PHARMACY_CREATE_SUBMIT,
  PLATFORM_PHARMACY_MEMBER_PHONE_LABEL,
  PLATFORM_PHARMACY_OPEN_SR,
  PLATFORM_PHARMACY_SEPARATION_HINT,
  PLATFORM_PHARMACY_SIMILAR_HINT,
  PLATFORM_PHARMACY_SIMILAR_TITLE,
  SHADOW_ACCOUNT_NOTICE,
  platformPharmacyCreated,
} from '@/lib/labels';
import type { Island, PharmacyStatus } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  FieldError,
  IconChevronRight,
  IconPlus,
  IconSearch,
  Modal,
  PHARMACY_TONES,
  Pagination,
  ReadOnlyNotice,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
  useDebounced,
  usePlatformRole,
} from './shared';

const ISLANDS: Island[] = ['ngazidja', 'ndzuwani', 'mwali'];

const FORM_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 'var(--ax-space-4)',
};

function CreatePharmacyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [island, setIsland] = useState<Island>('ngazidja');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberFirst, setMemberFirst] = useState('');
  const [memberLast, setMemberLast] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const debouncedName = useDebounced(name.trim());
  const debouncedCity = useDebounced(city.trim());

  /* Détection de doublons NON bloquante, miroir de la porte C patient : aucune
     contrainte d'unicité n'existe côté serveur — deux « Pharmacie du Port »
     peuvent coexister sur deux îles. L'exploitant est INFORMÉ, il décide.
     L'appel n'est lancé qu'avec un critère : sans, le backend renvoie 400. */
  const similar = useAsync(
    () =>
      debouncedName || debouncedCity
        ? listSimilarPharmacies({ name: debouncedName, city: debouncedCity })
        : Promise.resolve(null),
    [debouncedName, debouncedCity],
  );
  const duplicates = similar.data?.results ?? [];

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await createPlatformPharmacy({
        name: name.trim(),
        island,
        city: city.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        member_phone: memberPhone.trim(),
        member_first_name: memberFirst.trim(),
        member_last_name: memberLast.trim(),
      });
      onCreated(created.name);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={PLATFORM_PHARMACY_CREATE}
      onClose={onClose}
      width={680}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="pharmacy-create-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || name.trim() === '' || city.trim() === '' || memberPhone.trim() === ''}
          >
            {saving ? 'Enregistrement…' : PLATFORM_PHARMACY_CREATE_SUBMIT}
          </button>
        </>
      }
    >
      <form
        id="pharmacy-create-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <div className="ax-field">
          <label className="ax-label" htmlFor="pp-name">
            {PHARMACY_NAME_LABEL} <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="pp-name"
            type="text"
            className={`ax-input${error?.fieldErrors.name ? ' is-invalid' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            required
            autoComplete="off"
            data-autofocus=""
          />
          <FieldError error={error} field="name" />
        </div>

        <div style={FORM_GRID}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pp-island">
              {PHARMACY_ISLAND_LABEL} <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <select
              id="pp-island"
              className="ax-select"
              value={island}
              onChange={(e) => setIsland(e.target.value as Island)}
            >
              {ISLANDS.map((i) => (
                <option key={i} value={i}>
                  {ISLAND_LABELS[i]}
                </option>
              ))}
            </select>
            <FieldError error={error} field="island" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pp-city">
              {PHARMACY_CITY_LABEL} <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="pp-city"
              type="text"
              className={`ax-input${error?.fieldErrors.city ? ' is-invalid' : ''}`}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={128}
              required
              autoComplete="off"
            />
            <FieldError error={error} field="city" />
          </div>
        </div>

        {/* Le bandeau de doublons : informatif, `role="status"`, jamais
            bloquant (patron S3 de la porte C). */}
        {duplicates.length > 0 && (
          <div className="ax-alert ax-alert--info" role="status">
            <div className="ax-alert__content">
              <p className="ax-alert__title">{PLATFORM_PHARMACY_SIMILAR_TITLE}</p>
              <ul style={{ margin: 0, paddingInlineStart: 'var(--ax-space-5)', fontSize: 'var(--ax-text-sm)' }}>
                {duplicates.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    {p.name} · {p.city} · {PHARMACY_STATUS_LABELS[p.status]}
                  </li>
                ))}
              </ul>
              <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                {PLATFORM_PHARMACY_SIMILAR_HINT}
              </p>
            </div>
          </div>
        )}

        <div className="ax-field">
          <label className="ax-label" htmlFor="pp-address">
            {PHARMACY_ADDRESS_LABEL}
          </label>
          <input
            id="pp-address"
            type="text"
            className="ax-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={255}
            autoComplete="off"
          />
          <FieldError error={error} field="address" />
        </div>

        <div style={FORM_GRID}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pp-phone">
              {PHARMACY_PHONE_LABEL}
            </label>
            <input
              id="pp-phone"
              type="tel"
              inputMode="tel"
              className={`ax-input${error?.fieldErrors.phone ? ' is-invalid' : ''}`}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+269…"
              autoComplete="off"
            />
            {/* Ce numéro-là reçoit les SMS de notification : un envoi par
                OFFICINE, jamais par personne (ADR 0022 §16). */}
            <span className="ax-field__message">
              Le numéro de l&rsquo;officine — c&rsquo;est lui qui reçoit le SMS quand une
              demande arrive.
            </span>
            <FieldError error={error} field="phone" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pp-email">
              {PHARMACY_EMAIL_LABEL}
            </label>
            <input
              id="pp-email"
              type="email"
              className={`ax-input${error?.fieldErrors.email ? ' is-invalid' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
            <FieldError error={error} field="email" />
          </div>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--ax-border)', margin: 0 }} />

        <div className="ax-field">
          <label className="ax-label" htmlFor="pp-member-phone">
            {PLATFORM_PHARMACY_MEMBER_PHONE_LABEL}{' '}
            <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="pp-member-phone"
            type="tel"
            inputMode="tel"
            className={`ax-input${error?.fieldErrors.member_phone ? ' is-invalid' : ''}`}
            value={memberPhone}
            onChange={(e) => setMemberPhone(e.target.value)}
            placeholder="+269…"
            required
            autoComplete="off"
          />
          <FieldError error={error} field="member_phone" />
        </div>

        <div style={FORM_GRID}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pp-member-first">Prénom</label>
            <input
              id="pp-member-first"
              type="text"
              className="ax-input"
              value={memberFirst}
              onChange={(e) => setMemberFirst(e.target.value)}
              autoComplete="off"
            />
            <FieldError error={error} field="member_first_name" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pp-member-last">Nom</label>
            <input
              id="pp-member-last"
              type="text"
              className="ax-input"
              value={memberLast}
              onChange={(e) => setMemberLast(e.target.value)}
              autoComplete="off"
            />
            <FieldError error={error} field="member_last_name" />
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          {SHADOW_ACCOUNT_NOTICE}
        </p>
        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          {PLATFORM_PHARMACY_SEPARATION_HINT}
        </p>
      </form>
    </Modal>
  );
}

export function PlatformPharmacies() {
  const router = useRouter();
  const { canWrite } = usePlatformRole();
  const [status, setStatus] = useState<PharmacyStatus | ''>('');
  const [island, setIsland] = useState<Island | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const debounced = useDebounced(search.trim());

  const list = useAsync(
    () =>
      listPlatformPharmacies({
        ...(status ? { status } : {}),
        ...(island ? { island } : {}),
        ...(debounced ? { q: debounced } : {}),
        page,
      }),
    [status, island, debounced, page],
  );

  const rows = list.data?.results ?? [];
  const hasFilters = status !== '' || island !== '' || debounced !== '';

  return (
    <>
      <PlatformPageHead
        title={PLATFORM_PHARMACIES_TITLE}
        subtitle={PLATFORM_PHARMACIES_SUBTITLE}
        actions={
          canWrite ? (
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setCreateOpen(true)}>
              <IconPlus />
              <span className="ax-btn__label">{PLATFORM_PHARMACY_CREATE}</span>
            </button>
          ) : undefined
        }
      />

      <div className="ax-dash-grid">
        {flash && (
          <div className="ax-col--12">
            <div className="ax-alert ax-alert--success" role="status">
              <div className="ax-alert__content">
                <p className="ax-alert__message">{flash}</p>
              </div>
            </div>
          </div>
        )}

        <section className="ax-card ax-col--12" role="region" aria-label={PLATFORM_PHARMACIES_TITLE}>
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div
              className="ax-cluster"
              style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              <div className="ax-field" style={{ marginBottom: 0 }}>
                <label className="ax-label" htmlFor="pl-ph-status">État</label>
                <select
                  id="pl-ph-status"
                  className="ax-select ax-select--sm"
                  style={{ minWidth: 200 }}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as PharmacyStatus | '');
                    setPage(1);
                  }}
                >
                  <option value="">Toutes</option>
                  {PHARMACY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PHARMACY_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ax-field" style={{ marginBottom: 0 }}>
                <label className="ax-label" htmlFor="pl-ph-island">Île</label>
                <select
                  id="pl-ph-island"
                  className="ax-select ax-select--sm"
                  style={{ minWidth: 200 }}
                  value={island}
                  onChange={(e) => {
                    setIsland(e.target.value as Island | '');
                    setPage(1);
                  }}
                >
                  <option value="">Toutes les îles</option>
                  {ISLANDS.map((i) => (
                    <option key={i} value={i}>
                      {ISLAND_LABELS[i]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ax-field" style={{ marginBottom: 0, minWidth: 240 }}>
                <label className="ax-label" htmlFor="pl-ph-q">Rechercher</label>
                <div className="ax-field__control">
                  <span className="ax-field__affix ax-field__affix--leading">
                    <IconSearch className="" />
                  </span>
                  <input
                    id="pl-ph-q"
                    type="search"
                    className="ax-input ax-input--sm ax-input--with-leading-icon"
                    placeholder="Nom ou commune…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </div>

            {!canWrite && <ReadOnlyNotice />}
          </div>

          {list.loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : list.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={list.error} onRetry={list.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? PLATFORM_PHARMACIES_FILTER_EMPTY_TITLE : PLATFORM_PHARMACIES_EMPTY_TITLE}
              message={
                hasFilters
                  ? PLATFORM_PHARMACIES_FILTER_EMPTY_MESSAGE
                  : PLATFORM_PHARMACIES_EMPTY_MESSAGE
              }
              action={
                !hasFilters && canWrite ? (
                  <button
                    type="button"
                    className="ax-btn ax-btn--secondary"
                    onClick={() => setCreateOpen(true)}
                  >
                    <IconPlus />
                    <span className="ax-btn__label">{PLATFORM_PHARMACY_CREATE}</span>
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
                      <th className="ax-table__th" scope="col">{PLATFORM_PHARMACY_COL_NAME}</th>
                      <th className="ax-table__th" scope="col">{PLATFORM_PHARMACY_COL_ZONE}</th>
                      <th className="ax-table__th" scope="col">{PLATFORM_PHARMACY_COL_MEMBERS}</th>
                      <th className="ax-table__th" scope="col">{PLATFORM_PHARMACY_COL_DOCS}</th>
                      <th className="ax-table__th" scope="col">{PLATFORM_PHARMACY_COL_STATUS}</th>
                      <th className="ax-table__th" scope="col">
                        <span className="ax-visually-hidden">{PLATFORM_PHARMACY_OPEN_SR}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((pharmacy) => (
                      <tr
                        key={pharmacy.id}
                        className="ax-table__row"
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/plateforme/pharmacies/${pharmacy.id}`)}
                      >
                        <td className="ax-table__td">
                          <Link
                            href={`/plateforme/pharmacies/${pharmacy.id}`}
                            className="ax-link"
                            onClick={(ev) => ev.stopPropagation()}
                            style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}
                          >
                            {pharmacy.name}
                          </Link>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {pharmacy.city}
                          <span
                            style={{
                              display: 'block',
                              fontSize: 'var(--ax-text-xs)',
                              color: 'var(--ax-text-muted)',
                            }}
                          >
                            {ISLAND_LABELS[pharmacy.island]}
                          </span>
                        </td>
                        <td className="ax-table__td ax-num" style={{ color: 'var(--ax-text-muted)' }}>
                          {pharmacy.member_active_count}
                        </td>
                        <td className="ax-table__td ax-num" style={{ color: 'var(--ax-text-muted)' }}>
                          {pharmacy.document_count}
                        </td>
                        <td className="ax-table__td">
                          <StatusBadge
                            tone={PHARMACY_TONES[pharmacy.status]}
                            label={PHARMACY_STATUS_LABELS[pharmacy.status]}
                          />
                        </td>
                        <td className="ax-table__td" style={{ textAlign: 'end' }}>
                          <IconChevronRight className="" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {list.data && <Pagination count={list.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>

      {createOpen && canWrite && (
        <CreatePharmacyModal
          onClose={() => setCreateOpen(false)}
          onCreated={(name) => {
            setCreateOpen(false);
            setFlash(platformPharmacyCreated(name));
            setPage(1);
            list.reload();
          }}
        />
      )}
    </>
  );
}

export default PlatformPharmacies;
