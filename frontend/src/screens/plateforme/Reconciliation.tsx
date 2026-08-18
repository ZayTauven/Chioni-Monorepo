'use client';
/*
 * Chioni — /plateforme/reconciliation : les incidents de paiement (S4 lot 2).
 *
 * Base Vireo : la table filtrée de `tables/DataTables`, déjà adaptée pour la
 * caisse et les impayés du centre. Vue d'exploitation TECHNIQUE : des
 * références, des montants, un code d'incident — jamais un nom de patient,
 * jamais un nom de tuteur, jamais un libellé d'acte (le backend le verrouille
 * par un test de champs négatif, l'écran n'a donc rien à masquer).
 *
 * Vocabulaire : l'exploitant raisonne en INCIDENTS, pas en noms d'actions
 * d'audit. Les six codes sont traduits (INCIDENT_LABELS) et chaque ligne dit
 * ce que l'incident coûte (INCIDENT_IMPACT) — « le proche a peut-être été
 * débité » est l'information qui déclenche le travail.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import { listReconciliation } from '@/lib/endpoints/platform';
import {
  INCIDENT_CODES,
  INCIDENT_IMPACT,
  INCIDENT_LABELS,
  INCIDENT_REF_LABELS,
  auditPayloadHidden,
  formatDateTime,
  formatKmf,
  shiftIsoDate,
  todayIsoDate,
} from '@/lib/labels';
import type { IncidentCode, IncidentRefs, ReconciliationIncident } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  Pagination,
  Ref,
  StatusBadge,
  TableSkeleton,
  useAsync,
  type BadgeTone,
} from './shared';

/** Un débit possible chez le prestataire = danger ; le reste = neutre. */
const INCIDENT_TONES: Record<IncidentCode, BadgeTone> = {
  webhook_intent_not_payable: 'danger',
  webhook_request_not_payable: 'danger',
  webhook_invoice_cancelled: 'danger',
  webhook_balance_changed: 'danger',
  intent_stale_cancelled: 'warning',
  intent_failed: 'neutral',
};

/** Les montants sont des chaînes décimales KMF ; le reste, des références. */
const KMF_REF_KEYS = new Set(['intent_kmf', 'balance_kmf']);

/**
 * Les références d'un incident — **liste blanche d'affichage, fail-closed**.
 *
 * Le backend allow-liste déjà (`INCIDENT_REF_FIELDS`) ; l'écran ne rend que
 * les clés qui ont un libellé, pour que les deux barrières soient
 * indépendantes : une clé neuve côté service devra recevoir son libellé ici
 * avant d'atteindre un œil, et ne pourra jamais glisser dans cette table par
 * simple passe-plat. Le compte des clés ignorées est dit, jamais leur valeur.
 */
function RefList({ refs }: { refs: IncidentRefs }) {
  const entries = Object.entries(refs).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  const shown = entries.filter(([key]) => key in INCIDENT_REF_LABELS);
  const hidden = entries.length - shown.length;
  if (shown.length === 0 && hidden === 0) {
    return <span style={{ color: 'var(--ax-text-subtle)' }}>—</span>;
  }
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {shown.map(([key, value]) => (
        <li key={key} style={{ fontSize: 'var(--ax-text-xs)' }}>
          <span style={{ color: 'var(--ax-text-subtle)' }}>
            {INCIDENT_REF_LABELS[key]}
            {' : '}
          </span>
          <Ref>{KMF_REF_KEYS.has(key) ? formatKmf(String(value)) : String(value)}</Ref>
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

function IncidentRow({ incident }: { incident: ReconciliationIncident }) {
  return (
    <tr className="ax-table__row">
      <td className="ax-table__td" style={{ whiteSpace: 'nowrap', color: 'var(--ax-text-muted)' }}>
        {formatDateTime(incident.created_at)}
      </td>
      <td className="ax-table__td">
        <StatusBadge tone={INCIDENT_TONES[incident.incident]} label={INCIDENT_LABELS[incident.incident]} />
        <div style={{ marginTop: 4, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', maxWidth: 320 }}>
          {INCIDENT_IMPACT[incident.incident]}
        </div>
      </td>
      <td className="ax-table__td">
        {incident.center !== null ? (
          <Link href={`/plateforme/centres/${incident.center}`} className="ax-link">
            {incident.center_name ?? `Centre n° ${incident.center}`}
          </Link>
        ) : (
          <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>
            Centre inconnu (incident antérieur au suivi par centre)
          </span>
        )}
      </td>
      <td className="ax-table__td">
        <RefList refs={incident.refs} />
      </td>
    </tr>
  );
}

export function PlatformReconciliation() {
  const today = todayIsoDate();
  const [from, setFrom] = useState(shiftIsoDate(today, -29));
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState<'' | IncidentCode>('');
  const [page, setPage] = useState(1);

  const incidents = useAsync(
    () => listReconciliation({ from, to, reason: reason || undefined, page }),
    [from, to, reason, page],
  );
  const rows = incidents.data?.results ?? [];

  const resetPage = () => setPage(1);

  return (
    <>
      <PlatformPageHead
        title="Réconciliation des paiements"
        subtitle="Les moments où l'argent d'un proche n'a pas pu atteindre un centre — à rapprocher du prestataire de paiement."
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Incidents de paiement">
          <div className="ax-card__body" style={{ paddingBottom: 'var(--ax-space-3)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="ax-field" style={{ minWidth: 160 }}>
                <label className="ax-label" htmlFor="rc-from">Du</label>
                <input
                  id="rc-from"
                  type="date"
                  className="ax-input ax-input--sm"
                  value={from}
                  max={to}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    resetPage();
                  }}
                />
              </div>
              <div className="ax-field" style={{ minWidth: 160 }}>
                <label className="ax-label" htmlFor="rc-to">Au</label>
                <input
                  id="rc-to"
                  type="date"
                  className="ax-input ax-input--sm"
                  value={to}
                  min={from}
                  onChange={(e) => {
                    setTo(e.target.value);
                    resetPage();
                  }}
                />
              </div>
              <div className="ax-field" style={{ minWidth: 280, flex: '1 1 280px' }}>
                <label className="ax-label" htmlFor="rc-reason">Type d&apos;incident</label>
                <select
                  id="rc-reason"
                  className="ax-select ax-select--sm"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value as '' | IncidentCode);
                    resetPage();
                  }}
                >
                  <option value="">Tous les incidents</option>
                  {INCIDENT_CODES.map((code) => (
                    <option key={code} value={code}>
                      {INCIDENT_LABELS[code]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {incidents.loading ? (
            <TableSkeleton rows={6} cols={4} />
          ) : incidents.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={incidents.error} onRetry={incidents.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucun incident sur la période"
              message="Chaque paiement de la diaspora a atteint son centre. C'est l'état normal : cette page reste vide tant que rien ne casse."
            />
          ) : (
            <>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Date</th>
                      <th className="ax-table__th" scope="col">Incident</th>
                      <th className="ax-table__th" scope="col">Centre</th>
                      <th className="ax-table__th" scope="col">Références</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((incident) => (
                      <IncidentRow key={incident.id} incident={incident} />
                    ))}
                  </tbody>
                </table>
              </div>
              {incidents.data && (
                <Pagination count={incidents.data.count} page={page} onPage={setPage} />
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

export default PlatformReconciliation;
