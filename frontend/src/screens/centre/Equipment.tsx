'use client';
/*
 * Chioni — /centre/equipements : le parc de matériel du centre (S8, ADR 0021).
 *
 * Le plus petit écran du produit, et il répond à trois questions : **ce qu'on
 * a, où, et si ça marche**.
 *
 * Deux audiences, une seule liste :
 * - **tout membre actif LIT** le parc — d'où l'absence de garde de rôle sur
 *   l'entrée de sidebar (`NAV_ROLE_GATES` ne porte pas `centre.equipements`) ;
 * - **le directeur ÉCRIT** — « Déclarer un équipement » et « Modifier la
 *   fiche » sont gardés **à l'écran**, pas seulement dans la nav : la nav ne
 *   protège rien, elle range.
 *
 * **Rien n'est gelé ici** (ADR 0021 décision 4) : aucun bandeau d'abonnement,
 * aucun bouton grisé sur un centre `suspendu`/`resilie`/`impaye`. Ne pas en
 * ajouter — geler la saisie d'un inventaire n'a aucun levier commercial, et le
 * centre gelé est celui qui a le plus besoin que l'information circule.
 *
 * Assets Vireo repris et adaptés :
 * - `projects/ProjectsList.tsx` — la barre d'outils « pastilles de statut »
 *   (`ax-btn--pill` primary/secondary) et la recherche à icône avancée, déjà
 *   reprises pour les séjours (`Inpatient.tsx`) ;
 * - `tables/DataTables.tsx` — le tableau `ax-table--hover` à ligne cliquable,
 *   déjà adapté pour la caisse, les impayés et le journal.
 *
 * La bascule carte/liste de ProjectsList n'a PAS été reprise : deux vues d'un
 * même tableau de six colonnes est une option à entretenir sans question à
 * laquelle elle réponde.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import { listEquipments } from '@/lib/endpoints/equipment';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABEL,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_COL_NAME,
  EQUIPMENT_COL_STATUS,
  EQUIPMENT_CREATE_ACTION,
  EQUIPMENT_EMPTY_DIRECTOR,
  EQUIPMENT_EMPTY_STAFF,
  EQUIPMENT_EMPTY_TITLE,
  EQUIPMENT_FILTER_ALL,
  EQUIPMENT_FILTER_ALL_CATEGORIES,
  EQUIPMENT_FILTER_CLEAR,
  EQUIPMENT_FILTER_EMPTY_MESSAGE,
  EQUIPMENT_FILTER_EMPTY_TITLE,
  EQUIPMENT_FILTER_STATUS_GROUP,
  EQUIPMENT_LOCATION_LABEL,
  EQUIPMENT_NO_LOCATION,
  EQUIPMENT_NO_SERIAL,
  EQUIPMENT_OPEN_SR,
  EQUIPMENT_REPORTS_TITLE,
  EQUIPMENT_SEARCH_EMPTY_MESSAGE,
  EQUIPMENT_SEARCH_FILTERED_HINT,
  EQUIPMENT_SEARCH_LABEL,
  EQUIPMENT_SEARCH_LOCAL_HINT,
  EQUIPMENT_SEARCH_PLACEHOLDER,
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_SUBTITLE,
  EQUIPMENT_TITLE,
  equipmentCreated,
  equipmentLastReportLabel,
  equipmentParkSummary,
  equipmentReportCountLabel,
} from '@/lib/labels';
import type { Equipment as EquipmentRow, EquipmentCategory, EquipmentStatus } from '@/lib/types';
import { EquipmentFormModal } from './EquipmentShared';
import {
  EQUIPMENT_TONES,
  EmptyState,
  ErrorAlert,
  IconChevronRight,
  IconPlus,
  IconSearch,
  StatusBadge,
  TableSkeleton,
  hasRole,
  useAsync,
  useDebounced,
} from './shared';

/** Accents et casse mis de côté : « échographe » se trouve en tapant « echo ». */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    /* `\p{Diacritic}` plutôt qu'une plage de caractères combinants écrite en
       clair : ces derniers sont invisibles dans un fichier source et se font
       manger au premier copier-coller. */
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** L'ordre des pastilles : « Tous » d'abord — le parc se lit entier par défaut. */
const STATUS_PILLS: Array<EquipmentStatus | 'tous'> = ['tous', ...EQUIPMENT_STATUSES];

export function Equipment() {
  const { centerId, roles } = useCenter();
  const router = useRouter();
  const director = hasRole(roles, ['directeur']);

  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | 'tous'>('tous');
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | ''>('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search.trim());

  /* Liste NON paginée (« le parc tient à l'écran ») : état et catégorie sont
     filtrés SERVEUR — leurs valeurs hors liste fermée renvoient 400 par champ,
     d'où des sélecteurs bornés à `EQUIPMENT_STATUSES` / `EQUIPMENT_CATEGORIES`. */
  const parc = useAsync(
    () =>
      listEquipments(centerId, {
        ...(statusFilter === 'tous' ? {} : { status: statusFilter }),
        ...(categoryFilter === '' ? {} : { category: categoryFilter }),
      }),
    [centerId, statusFilter, categoryFilter],
  );

  /* Un message de succès nomme un appareil du centre où il a été écrit : il
     doit mourir avec le sélecteur de centre de l'en-tête, qui ne quitte pas la
     page (patron S5 du `patched` non lié à la route). */
  useEffect(() => {
    setFlash(null);
  }, [centerId]);

  const items = useMemo(() => parc.data ?? [], [parc.data]);

  /* La recherche est LOCALE : le backend n'expose pas de `?q=`, et sur une
     liste entière c'est le bon compromis — zéro aller-retour sur une connexion
     comorienne. L'écran le dit sous le champ plutôt que de laisser croire à
     une recherche du registre entier. */
  const shown = useMemo(() => {
    if (!debouncedSearch) return items;
    const needle = normalize(debouncedSearch);
    return items.filter((item) =>
      normalize(`${item.name} ${item.location} ${item.serial_number}`).includes(needle),
    );
  }, [items, debouncedSearch]);

  /*
   * Deux notions distinctes, et les confondre coûtait un écran (revue UX care
   * S8) :
   * - `hasServerFilters` décrit ce que le SERVEUR a renvoyé. C'est lui qui
   *   explique une liste vide, et lui seul : taper trois lettres dans la
   *   recherche ne peut pas vider un parc. Confondu avec la recherche, il
   *   remplaçait l'accueil du directeur sur un centre neuf (« Commencez par le
   *   matériel que votre équipe utilise tous les jours… » + son bouton
   *   « Déclarer un équipement ») par un « Aucun appareil ne correspond » au
   *   premier caractère tapé — l'onboarding perdu par une faute de frappe.
   * - `hasFilters` ajoute la recherche locale, et ne sert qu'au bouton
   *   « Effacer les filtres », qui, lui, remet bien les trois à zéro.
   */
  const hasServerFilters = statusFilter !== 'tous' || categoryFilter !== '';
  const hasFilters = hasServerFilters || search !== '';

  /* Le résumé n'est affiché QUE sur le parc entier : sous filtre, « 2 en
     panne » compterait la page filtrée et mentirait sur le centre. */
  const summary =
    statusFilter === 'tous' && categoryFilter === '' && !debouncedSearch && items.length > 0
      ? equipmentParkSummary(
          items.length,
          items.filter((i) => i.status === 'en_panne').length,
          items.filter((i) => i.status === 'reforme').length,
        )
      : null;

  return (
    <>
      <PageHead
        title={EQUIPMENT_TITLE}
        subtitle={EQUIPMENT_SUBTITLE}
        actions={
          /* Garde D'ÉCRAN : le backend renvoie 403 aux six autres casquettes.
             Monter le bouton pour qu'il échoue serait une promesse fausse. */
          director ? (
            <button
              type="button"
              className="ax-btn ax-btn--primary"
              onClick={() => setCreateOpen(true)}
            >
              <IconPlus />
              <span className="ax-btn__label">{EQUIPMENT_CREATE_ACTION}</span>
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

        <section className="ax-card ax-col--12" role="region" aria-label={EQUIPMENT_TITLE}>
          <div
            className="ax-card__header"
            style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}
          >
            <div
              className="ax-cluster"
              style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              {/* Pastilles d'état — patron ProjectsList de Vireo. */}
              <div
                className="ax-cluster"
                style={{ gap: 'var(--ax-space-2)' }}
                role="group"
                aria-label={EQUIPMENT_FILTER_STATUS_GROUP}
              >
                {STATUS_PILLS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`ax-btn ax-btn--sm ax-btn--pill ${statusFilter === key ? 'ax-btn--primary' : 'ax-btn--secondary'}`}
                    aria-pressed={statusFilter === key}
                    onClick={() => setStatusFilter(key)}
                  >
                    {key === 'tous' ? EQUIPMENT_FILTER_ALL : EQUIPMENT_STATUS_LABELS[key]}
                  </button>
                ))}
              </div>

              <div className="ax-field" style={{ marginBottom: 0 }}>
                <label className="ax-label" htmlFor="eq-f-category">
                  {EQUIPMENT_CATEGORY_LABEL}
                </label>
                <select
                  id="eq-f-category"
                  className="ax-select ax-select--sm"
                  style={{ minWidth: 180 }}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as EquipmentCategory | '')}
                >
                  <option value="">{EQUIPMENT_FILTER_ALL_CATEGORIES}</option>
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {EQUIPMENT_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ax-field" style={{ marginBottom: 0, minWidth: 260 }}>
                <label className="ax-label" htmlFor="eq-search">
                  {EQUIPMENT_SEARCH_LABEL}
                </label>
                <div className="ax-field__control">
                  <span className="ax-field__affix ax-field__affix--leading">
                    <IconSearch className="" />
                  </span>
                  <input
                    id="eq-search"
                    type="search"
                    className="ax-input ax-input--sm ax-input--with-leading-icon"
                    placeholder={EQUIPMENT_SEARCH_PLACEHOLDER}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {/* Sous filtre, la recherche ne voit qu'un sous-ensemble : le
                    dire ET donner le geste qui l'ouvre, sinon « je ne trouve
                    pas l'échographe » se lit « le centre n'a pas d'échographe ». */}
                <span className="ax-field__message">
                  {hasServerFilters ? EQUIPMENT_SEARCH_FILTERED_HINT : EQUIPMENT_SEARCH_LOCAL_HINT}
                </span>
              </div>

              {hasFilters && (
                <button
                  type="button"
                  className="ax-btn ax-btn--ghost ax-btn--sm"
                  onClick={() => {
                    setStatusFilter('tous');
                    setCategoryFilter('');
                    setSearch('');
                  }}
                >
                  {EQUIPMENT_FILTER_CLEAR}
                </button>
              )}
            </div>

            {summary && (
              <p
                className="ax-num"
                style={{
                  margin: 0,
                  fontSize: 'var(--ax-text-sm)',
                  color: 'var(--ax-text-muted)',
                }}
              >
                {summary}
              </p>
            )}
          </div>

          {parc.loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : parc.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={parc.error} onRetry={parc.reload} />
            </div>
          ) : items.length === 0 ? (
            /* Liste SERVEUR vide : seuls les filtres serveur peuvent
               l'expliquer — d'où `hasServerFilters` et non `hasFilters`. */
            <EmptyState
              title={hasServerFilters ? EQUIPMENT_FILTER_EMPTY_TITLE : EQUIPMENT_EMPTY_TITLE}
              message={
                hasServerFilters
                  ? EQUIPMENT_FILTER_EMPTY_MESSAGE
                  : director
                    ? EQUIPMENT_EMPTY_DIRECTOR
                    : EQUIPMENT_EMPTY_STAFF
              }
              action={
                !hasServerFilters && director ? (
                  <button
                    type="button"
                    className="ax-btn ax-btn--secondary"
                    onClick={() => setCreateOpen(true)}
                  >
                    <IconPlus />
                    <span className="ax-btn__label">{EQUIPMENT_CREATE_ACTION}</span>
                  </button>
                ) : undefined
              }
            />
          ) : shown.length === 0 ? (
            /* La liste chargée n'est PAS vide : la seule cause possible est la
               recherche locale. Le message la nomme, au lieu de renvoyer vers
               des filtres qu'on n'a peut-être même pas touchés. */
            <EmptyState
              title={EQUIPMENT_FILTER_EMPTY_TITLE}
              message={EQUIPMENT_SEARCH_EMPTY_MESSAGE}
            />
          ) : (
            <div className="ax-table-wrap">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">
                      {EQUIPMENT_COL_NAME}
                    </th>
                    <th className="ax-table__th" scope="col">
                      {EQUIPMENT_CATEGORY_LABEL}
                    </th>
                    <th className="ax-table__th" scope="col">
                      {EQUIPMENT_LOCATION_LABEL}
                    </th>
                    <th className="ax-table__th" scope="col">
                      {EQUIPMENT_REPORTS_TITLE}
                    </th>
                    <th className="ax-table__th" scope="col">
                      {EQUIPMENT_COL_STATUS}
                    </th>
                    <th className="ax-table__th" scope="col">
                      <span className="ax-visually-hidden">{EQUIPMENT_OPEN_SR}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((item) => (
                    <EquipmentTableRow
                      key={item.id}
                      item={item}
                      onOpen={() => router.push(`/centre/equipements/${item.id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {createOpen && (
        <EquipmentFormModal
          onClose={() => setCreateOpen(false)}
          onSaved={(saved) => {
            setCreateOpen(false);
            setFlash(equipmentCreated(saved.name));
            parc.reload();
          }}
        />
      )}
    </>
  );
}

function EquipmentTableRow({ item, onOpen }: { item: EquipmentRow; onOpen: () => void }) {
  return (
    <tr className="ax-table__row" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <td className="ax-table__td">
        <Link
          href={`/centre/equipements/${item.id}`}
          className="ax-link"
          onClick={(ev) => ev.stopPropagation()}
          style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}
        >
          {item.name}
        </Link>
        <span
          style={{
            display: 'block',
            fontSize: 'var(--ax-text-xs)',
            color: 'var(--ax-text-muted)',
          }}
        >
          {item.serial_number || EQUIPMENT_NO_SERIAL}
        </span>
      </td>
      <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
        {EQUIPMENT_CATEGORY_LABELS[item.category]}
      </td>
      <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', maxWidth: 220 }}>
        <span className="ax-truncate" style={{ display: 'block' }}>
          {item.location || EQUIPMENT_NO_LOCATION}
        </span>
      </td>
      <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
        {/* Le compteur, et la DATE du dernier constat : « 3 signalements » seul
            ne dit pas si la panne date d'hier ou de l'an dernier. */}
        {equipmentReportCountLabel(item.report_count)}
        {item.last_report_at && (
          <span
            style={{
              display: 'block',
              fontSize: 'var(--ax-text-xs)',
              color: 'var(--ax-text-muted)',
            }}
          >
            {equipmentLastReportLabel(item.last_report_at)}
          </span>
        )}
      </td>
      <td className="ax-table__td">
        <StatusBadge
          tone={EQUIPMENT_TONES[item.status]}
          label={EQUIPMENT_STATUS_LABELS[item.status]}
        />
      </td>
      <td className="ax-table__td" style={{ textAlign: 'end' }}>
        <IconChevronRight className="" />
      </td>
    </tr>
  );
}

export default Equipment;
