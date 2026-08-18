'use client';
/*
 * Chioni — /centre/journal : le journal d'audit du centre (S4, ADR 0017 déc. 5).
 *
 * DIRECTEUR SEUL — ce n'est pas une vue BILLING : le journal agrège les
 * décisions de personnel, l'argent et les litiges. L'écran est auto-gardé (le
 * rôle est vérifié avant tout fetch) et l'entrée de sidebar est gatée de la
 * même manière (NAV_ROLE_GATES).
 *
 * Base Vireo : la table filtrée de `tables/DataTables`, déjà adaptée pour les
 * impayés et la caisse.
 *
 * Trois honnêtetés portées par cet écran :
 * 1. **le journal ne rétro-remplit rien** — la table est append-only, aucune
 *    ligne antérieure à la migration ne porte de centre. `journal_starts_at`
 *    est affiché tel quel : « Le journal de votre centre commence le … » ;
 * 2. **le sélecteur ne propose QUE la liste blanche** — toute autre valeur
 *    renvoie 400 « Action inconnue. » (même message pour une faute de frappe
 *    et pour une action cliniquement masquée : pas d'oracle). Le sélecteur ne
 *    peut donc structurellement pas échouer ;
 * 3. **le clinique n'est pas ici, et ne le sera pas** — l'écran le dit, pour
 *    qu'un directeur ne croie pas lire un journal complet des soins.
 */
import { useState } from 'react';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import { listAuditLog } from '@/lib/endpoints/centers';
import {
  AUDIT_ACTION_GROUPS,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTOR_AUTOMATIC,
  AUDIT_JOURNAL_EMPTY,
  AUDIT_NO_CLINICAL_NOTICE,
  AUDIT_PAYLOAD_LABELS,
  auditJournalStartsAt,
  auditPayloadHidden,
  formatDate,
  formatDateTime,
  shiftIsoDate,
  todayIsoDate,
} from '@/lib/labels';
import type { AuditAction, AuditLogEntry } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  Pagination,
  TableSkeleton,
  hasRole,
  useAsync,
} from './shared';

/** Une valeur de payload — scalaire par contrat backend (ADR 0007). */
function payloadValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Le détail d'une ligne — **liste blanche d'affichage, fail-closed**.
 *
 * L'API rend `payload` TEL QUEL (vigilance actée ADR 0017 lot 2). Rendre
 * `Object.entries()` ferait de l'écran un passe-plat : une clé bavarde
 * ajoutée demain à une action de la liste blanche (un nom, un téléphone)
 * s'afficherait sans qu'une ligne de frontend ait changé. On ne rend donc
 * que les clés qui ont un libellé — l'ajout d'une clé au journal est un acte
 * conscient, exactement comme l'ajout d'une action côté backend.
 */
function PayloadCell({ entry }: { entry: AuditLogEntry }) {
  const entries = Object.entries(entry.payload ?? {});
  const shown = entries.filter(([key]) => key in AUDIT_PAYLOAD_LABELS);
  const hidden = entries.length - shown.length;
  if (shown.length === 0 && hidden === 0) {
    return <span style={{ color: 'var(--ax-text-subtle)' }}>—</span>;
  }
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {shown.map(([key, value]) => (
        <li key={key} style={{ fontSize: 'var(--ax-text-xs)' }}>
          <span style={{ color: 'var(--ax-text-subtle)' }}>
            {AUDIT_PAYLOAD_LABELS[key]}
            {' : '}
          </span>
          <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>
            {payloadValue(value)}
          </span>
        </li>
      ))}
      {hidden > 0 && (
        <li style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontStyle: 'italic' }}>
          {auditPayloadHidden(hidden)}
        </li>
      )}
    </ul>
  );
}

export function AuditJournal() {
  const { centerId, roles } = useCenter();
  // Multi-rôles S2 : un directeur-médecin garde l'accès au journal.
  const isDirector = hasRole(roles, ['directeur']);

  const today = todayIsoDate();
  const [from, setFrom] = useState(shiftIsoDate(today, -29));
  const [to, setTo] = useState(today);
  const [action, setAction] = useState<'' | AuditAction>('');
  const [page, setPage] = useState(1);

  const journal = useAsync(
    () =>
      isDirector
        ? listAuditLog(centerId, { from, to, action: action || undefined, page })
        : Promise.resolve(null),
    [centerId, isDirector, from, to, action, page],
  );

  if (!isDirector) {
    return (
      <>
        <PageHead title="Journal du centre" />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              <EmptyState
                title="Écran réservé au directeur"
                message="Le journal rassemble les décisions de personnel, l'argent et les litiges du centre. Il est réservé à la direction."
              />
            </div>
          </section>
        </div>
      </>
    );
  }

  const rows = journal.data?.results ?? [];
  const startsAt = journal.data?.journal_starts_at ?? null;

  return (
    <>
      <PageHead
        title="Journal du centre"
        subtitle="Qui a fait quoi, et quand — personnel, tarifs, factures, caisse, paiements et litiges."
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Journal d'audit du centre">
          <div className="ax-card__body" style={{ paddingBottom: 'var(--ax-space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="ax-field" style={{ minWidth: 160 }}>
                <label className="ax-label" htmlFor="aj-from">Du</label>
                <input
                  id="aj-from"
                  type="date"
                  className="ax-input ax-input--sm"
                  value={from}
                  max={to}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="ax-field" style={{ minWidth: 160 }}>
                <label className="ax-label" htmlFor="aj-to">Au</label>
                <input
                  id="aj-to"
                  type="date"
                  className="ax-input ax-input--sm"
                  value={to}
                  min={from}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="ax-field" style={{ minWidth: 280, flex: '1 1 280px' }}>
                <label className="ax-label" htmlFor="aj-action">Type d&apos;événement</label>
                <select
                  id="aj-action"
                  className="ax-select ax-select--sm"
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value as '' | AuditAction);
                    setPage(1);
                  }}
                >
                  <option value="">Tous les événements</option>
                  {AUDIT_ACTION_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.actions.map((a) => (
                        <option key={a} value={a}>
                          {AUDIT_ACTION_LABELS[a]}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Deux honnêtetés, deux phrases : les fondre en un seul bloc de
                légende grise les rendait illisibles ensemble. `text-subtle`
                (#6E7A92) est sous AA à cette taille — ces deux phrases-là
                doivent être lues, elles passent en `text-muted`. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                {startsAt ? auditJournalStartsAt(formatDate(startsAt)) : AUDIT_JOURNAL_EMPTY}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                {AUDIT_NO_CLINICAL_NOTICE}
              </p>
            </div>
          </div>

          {journal.loading ? (
            <TableSkeleton rows={6} cols={4} />
          ) : journal.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={journal.error} onRetry={journal.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucun événement sur cette période"
              message={
                action
                  ? 'Aucun événement de ce type entre ces deux dates. Élargissez la période ou choisissez « Tous les événements ».'
                  : 'Élargissez la période pour remonter plus loin dans l’activité de votre centre.'
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Date</th>
                      <th className="ax-table__th" scope="col">Événement</th>
                      <th className="ax-table__th" scope="col">Par</th>
                      <th className="ax-table__th" scope="col">Détail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((entry) => (
                      <tr key={entry.id} className="ax-table__row">
                        <td className="ax-table__td" style={{ whiteSpace: 'nowrap', color: 'var(--ax-text-muted)' }}>
                          {formatDateTime(entry.created_at)}
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>
                          {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {/* Un nom seulement pour un membre de CE centre ;
                              sinon « — » : ne jamais deviner une identité.
                              S5 : un passage `actif ⇄ impayé` posé par la tâche
                              quotidienne n'a PAS d'acteur (`actor: null` +
                              `automatic: true`). Le dire vaut mieux qu'un tiret
                              qui ferait chercher une main. */}
                          {entry.actor_display ??
                            (entry.actor === null && entry.payload?.automatic === true
                              ? AUDIT_ACTOR_AUTOMATIC
                              : '—')}
                        </td>
                        <td className="ax-table__td">
                          <PayloadCell entry={entry} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {journal.data && <Pagination count={journal.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>
    </>
  );
}

export default AuditJournal;
