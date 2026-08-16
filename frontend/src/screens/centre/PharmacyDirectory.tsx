'use client';
/*
 * Chioni — /centre/pharmacies : l'annuaire du réseau (S9, ADR 0022).
 *
 * ─── Pourquoi un écran SÉPARÉ du comptoir ─────────────────────────────────
 *
 * Les audiences ne sont pas les mêmes, et le backend le dit : l'annuaire est
 * ouvert à **tout staff actif** (savoir quelles officines existent n'est pas
 * une information clinique — c'est la secrétaire qui aura à en appeler une),
 * tandis que lancer et lire une recherche est réservé aux rôles cliniques et
 * au pharmacien. En faire deux onglets d'un même écran aurait servi à une
 * secrétaire une page dont l'essentiel répond 403 ; le gater entièrement lui
 * aurait retiré le seul contenu qui la concerne. Deux portes, deux audiences,
 * deux entrées — exactement l'arbitrage « Équipe du jour » vs « Registre du
 * personnel » de S7.
 *
 * ─── Ce que l'annuaire ne dit pas ─────────────────────────────────────────
 *
 * Aucun statut d'officine : la route ne rend que les pharmacies **validées**,
 * donc le champ n'apprendrait rien — et il ferait de l'annuaire une fenêtre
 * sur les décisions de la plateforme. Une phrase le dit à la place, sinon
 * « il en manque une » se lirait comme un bug.
 *
 * Aucune carte, aucune distance, aucun itinéraire : le ciblage du produit est
 * **administratif** (île + commune) et le restera — on ne localise personne, et
 * on ne charge pas de fond de carte sur un Android d'entrée de gamme en 2G.
 *
 * Assets Vireo repris : `tables/DataTables` pour le tableau, et la recherche à
 * icône avancée de `projects/ProjectsList` (déjà adaptée pour le parc S8).
 */
import { useState } from 'react';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import { listPharmacies } from '@/lib/endpoints/pharmacy';
import {
  DIRECTORY_COL_NAME,
  DIRECTORY_COL_PHONE,
  DIRECTORY_COL_ZONE,
  DIRECTORY_EMPTY_MESSAGE,
  DIRECTORY_EMPTY_TITLE,
  DIRECTORY_FILTER_ALL_ISLANDS,
  DIRECTORY_FILTER_EMPTY_MESSAGE,
  DIRECTORY_FILTER_EMPTY_TITLE,
  DIRECTORY_NO_ADDRESS,
  DIRECTORY_NO_PHONE,
  DIRECTORY_SEARCH_LABEL,
  DIRECTORY_SEARCH_PLACEHOLDER,
  DIRECTORY_SUBTITLE,
  DIRECTORY_TITLE,
  DIRECTORY_VALIDATED_ONLY_HINT,
  ISLAND_LABELS,
} from '@/lib/labels';
import type { Island } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  IconSearch,
  TableSkeleton,
  useAsync,
  useDebounced,
} from './shared';

const ISLANDS: Island[] = ['ngazidja', 'ndzuwani', 'mwali'];

export function PharmacyDirectory() {
  const { centerId } = useCenter();
  const [island, setIsland] = useState<Island | ''>('');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());

  /* La recherche est SERVEUR (`?q=` sur le nom ou la commune) : contrairement
     au parc de matériel, l'annuaire peut couvrir tout le pays — filtrer
     localement une liste qu'on n'a pas entièrement chargée mentirait. */
  const list = useAsync(
    () =>
      listPharmacies(centerId, {
        ...(island ? { island } : {}),
        ...(debounced ? { q: debounced } : {}),
      }),
    [centerId, island, debounced],
  );

  const rows = list.data ?? [];
  const hasFilters = island !== '' || debounced !== '';

  return (
    <>
      <PageHead title={DIRECTORY_TITLE} subtitle={DIRECTORY_SUBTITLE} />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label={DIRECTORY_TITLE}>
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div
              className="ax-cluster"
              style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              <div className="ax-field" style={{ marginBottom: 0 }}>
                <label className="ax-label" htmlFor="dir-island">
                  Île
                </label>
                <select
                  id="dir-island"
                  className="ax-select ax-select--sm"
                  style={{ minWidth: 200 }}
                  value={island}
                  onChange={(e) => setIsland(e.target.value as Island | '')}
                >
                  <option value="">{DIRECTORY_FILTER_ALL_ISLANDS}</option>
                  {ISLANDS.map((i) => (
                    <option key={i} value={i}>
                      {ISLAND_LABELS[i]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ax-field" style={{ marginBottom: 0, minWidth: 260 }}>
                <label className="ax-label" htmlFor="dir-search">
                  {DIRECTORY_SEARCH_LABEL}
                </label>
                <div className="ax-field__control">
                  <span className="ax-field__affix ax-field__affix--leading">
                    <IconSearch className="" />
                  </span>
                  <input
                    id="dir-search"
                    type="search"
                    className="ax-input ax-input--sm ax-input--with-leading-icon"
                    placeholder={DIRECTORY_SEARCH_PLACEHOLDER}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {list.loading ? (
            <TableSkeleton rows={5} cols={3} />
          ) : list.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={list.error} onRetry={list.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? DIRECTORY_FILTER_EMPTY_TITLE : DIRECTORY_EMPTY_TITLE}
              message={hasFilters ? DIRECTORY_FILTER_EMPTY_MESSAGE : DIRECTORY_EMPTY_MESSAGE}
            />
          ) : (
            <div className="ax-table-wrap">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">{DIRECTORY_COL_NAME}</th>
                    <th className="ax-table__th" scope="col">{DIRECTORY_COL_ZONE}</th>
                    <th className="ax-table__th" scope="col">{DIRECTORY_COL_PHONE}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((pharmacy) => (
                    <tr key={pharmacy.id} className="ax-table__row">
                      <td className="ax-table__td">
                        <span style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>
                          {pharmacy.name}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--ax-text-xs)',
                            color: 'var(--ax-text-muted)',
                          }}
                        >
                          {pharmacy.address || DIRECTORY_NO_ADDRESS}
                        </span>
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
                      <td className="ax-table__td">
                        {/* Appeler est le geste utile — depuis un poste comme
                            depuis un mobile, le lien `tel:` fonctionne. */}
                        {pharmacy.phone ? (
                          <a className="ax-link" href={`tel:${pharmacy.phone}`}>
                            {pharmacy.phone}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--ax-text-muted)' }}>{DIRECTORY_NO_PHONE}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              {DIRECTORY_VALIDATED_ONLY_HINT}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export default PharmacyDirectory;
