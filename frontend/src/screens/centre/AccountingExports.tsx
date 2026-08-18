'use client';
/*
 * Chioni — /centre/comptabilite : les relevés de caisse figés (S10, ADR 0023).
 *
 * **Rôles BILLING**, auto-gardé AVANT le fetch (patron `caisse` / `impayes`) :
 * c'est la caisse du centre qui sort de l'application.
 *
 * Base Vireo : la table filtrable de `tables/` (déjà adaptée par `Invoices`,
 * `UnpaidInvoices`, `SubscriptionInvoices`) pour la liste, et la modale du
 * socle pour la génération. Rien de neuf n'a été dessiné.
 *
 * Trois choses que cet écran DOIT dire, et qui sont des exigences de contrat,
 * pas du décor :
 *
 * 1. **une pièce est figée** — elle garde ce qu'elle disait le jour où elle a
 *    été générée, même si la caisse a bougé depuis. C'est la propriété qui la
 *    rend utilisable par un comptable ;
 * 2. **`previous_export` n'est pas une erreur** — une période peut être
 *    relevée deux fois, rien ne se ferme derrière un export (arbitrage PO
 *    n° 3). On l'annonce calmement, on ne bloque pas, on n'alarme pas ;
 * 3. **le geste est audité** et remonte au journal du directeur — d'où la
 *    modale de confirmation, comme pour une facture d'abonnement.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import { createAccountingExport, listAccountingExports } from '@/lib/endpoints/accounting';
import {
  ACCOUNTING_FROZEN_NOTICE,
  ACCOUNTING_GENERATE_LABEL,
  ACCOUNTING_GENERATE_NOTICE,
  ACCOUNTING_GENERATE_TITLE,
  ACCOUNTING_SUBTITLE,
  ACCOUNTING_TITLE,
  accountingPeriodLabel,
  exportGeneratedNotice,
  formatDateTime,
  formatKmf,
  previousExportNotice,
  todayIsoDate,
} from '@/lib/labels';
import type { AccountingExport, AccountingExportCreated } from '@/lib/types';
import {
  BILLING_ROLES,
  EmptyState,
  ErrorAlert,
  FieldError,
  Modal,
  Pagination,
  TableSkeleton,
  hasRole,
  toApiError,
  useAsync,
  useScopedState,
} from './shared';

/** Le premier jour du mois précédent — la période qu'on relève en pratique. */
function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime());
  lastOfPrevMonth.setDate(0);
  const firstOfPrevMonth = new Date(
    lastOfPrevMonth.getFullYear(),
    lastOfPrevMonth.getMonth(),
    1,
    12,
    0,
    0,
  );
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: iso(firstOfPrevMonth), end: iso(lastOfPrevMonth) };
}

/* ── la modale de génération ─────────────────────────────────────────────── */

function GenerateExportModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (created: AccountingExportCreated) => void;
}) {
  const { centerId } = useCenter();
  const initial = defaultPeriod();
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createAccountingExport(centerId, {
        period_start: start,
        period_end: end,
      });
      onDone(created);
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={ACCOUNTING_GENERATE_TITLE}
      onClose={onClose}
      width={520}
      busy={busy}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button
            type="submit"
            form="accounting-export-form"
            className="ax-btn ax-btn--primary"
            disabled={busy || !start || !end}
          >
            {busy ? 'Génération…' : ACCOUNTING_GENERATE_LABEL}
          </button>
        </>
      }
    >
      <form
        id="accounting-export-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {/* Le focus initial va au premier CHAMP, jamais au bouton d'action :
            une touche Entrée ne doit pas générer une pièce auditée (piège
            relevé en S4 sur un geste bien plus grave). */}
        <div className="ax-field">
          <label className="ax-label" htmlFor="ae-start">
            Du <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="ae-start"
            type="date"
            className="ax-input"
            required
            value={start}
            max={end && end <= todayIsoDate() ? end : todayIsoDate()}
            onChange={(e) => setStart(e.target.value)}
            data-autofocus=""
          />
          <FieldError error={error} field="period_start" />
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="ae-end">
            Au <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          {/* Borné à AUJOURD'HUI. Le backend accepte une période future : il
              émettrait un relevé vide — et comme la série « E- » est
              append-only, la faute de frappe brûlerait un numéro pour
              toujours. Une pièce comptable ne se rattrape pas. */}
          <input
            id="ae-end"
            type="date"
            className="ax-input"
            required
            value={end}
            min={start}
            max={todayIsoDate()}
            onChange={(e) => setEnd(e.target.value)}
          />
          <FieldError error={error} field="period_end" />
        </div>

        <div className="ax-alert ax-alert--info" role="note">
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ margin: 0, lineHeight: 1.7 }}>
              {ACCOUNTING_GENERATE_NOTICE}
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ── l'écran ─────────────────────────────────────────────────────────────── */

interface Outcome {
  notice: string;
  previous: string | null;
}

export function AccountingExports() {
  const { centerId, roles } = useCenter();
  const billing = hasRole(roles, BILLING_ROLES);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  /* Le résultat de la génération meurt avec le centre actif. */
  const [outcome, setOutcome] = useScopedState<Outcome>(String(centerId));

  const list = useAsync(
    () => (billing ? listAccountingExports(centerId, page) : Promise.resolve(null)),
    [centerId, page, billing],
  );

  if (!billing) {
    return (
      <>
        <PageHead title={ACCOUNTING_TITLE} subtitle={ACCOUNTING_SUBTITLE} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <EmptyState
              title="Réservé aux rôles de facturation"
              message="Les relevés de caisse sont accessibles au directeur, à la secrétaire et au caissier. Votre rôle actuel ne couvre pas la vue financière du centre."
            />
          </section>
        </div>
      </>
    );
  }

  const rows: AccountingExport[] = list.data?.results ?? [];

  return (
    <>
      <PageHead
        title={ACCOUNTING_TITLE}
        subtitle={ACCOUNTING_SUBTITLE}
        actions={
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => {
              setOutcome(null);
              setModalOpen(true);
            }}
          >
            <span className="ax-btn__label">{ACCOUNTING_GENERATE_LABEL}</span>
          </button>
        }
      />

      <div className="ax-dash-grid">
        {outcome && (
          <div className="ax-col--12" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-alert ax-alert--success" role="status">
              <div className="ax-alert__content">
                <p className="ax-alert__message" style={{ margin: 0 }}>
                  {outcome.notice}
                </p>
              </div>
            </div>
            {/* `previous_export` n'est PAS une erreur : ton neutre, aucun
                blocage, et surtout aucune couleur d'alarme. */}
            {outcome.previous && (
              <div className="ax-alert ax-alert--info" role="note">
                <div className="ax-alert__content">
                  <p className="ax-alert__message" style={{ margin: 0, lineHeight: 1.7 }}>
                    {outcome.previous}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="ax-col--12">
          <div className="ax-alert ax-alert--info" role="note">
            <div className="ax-alert__content">
              <p className="ax-alert__message" style={{ margin: 0, lineHeight: 1.7 }}>
                {ACCOUNTING_FROZEN_NOTICE}
              </p>
            </div>
          </div>
        </div>

        <section className="ax-card ax-col--12" role="region" aria-label="Relevés de caisse">
          {list.loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : list.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={list.error} onRetry={list.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucun relevé pour le moment"
              message="Générez un relevé quand votre comptable en a besoin : il fige les encaissements et les corrections de la période, et reste consultable ensuite."
              action={
                <button
                  type="button"
                  className="ax-btn ax-btn--primary"
                  onClick={() => {
                    setOutcome(null);
                    setModalOpen(true);
                  }}
                >
                  <span className="ax-btn__label">{ACCOUNTING_GENERATE_LABEL}</span>
                </button>
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Relevé</th>
                      <th className="ax-table__th" scope="col">Période</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Encaissé</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Contre-passé</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Net</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Mouvements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="ax-table__row">
                        <td className="ax-table__td">
                          <Link
                            href={`/centre/comptabilite/${row.id}`}
                            className="ax-link ax-num"
                            style={{ fontWeight: 500, fontFamily: 'var(--ax-font-mono)' }}
                          >
                            {row.number}
                          </Link>
                          <span
                            style={{
                              display: 'block',
                              fontSize: 'var(--ax-text-2xs)',
                              color: 'var(--ax-text-muted)',
                            }}
                          >
                            généré le {formatDateTime(row.created_at)}
                          </span>
                        </td>
                        <td className="ax-table__td" style={{ fontSize: 'var(--ax-text-sm)' }}>
                          {accountingPeriodLabel(row.period_start, row.period_end)}
                        </td>
                        <td
                          className="ax-table__td ax-table__td--num ax-num"
                          style={{ fontFamily: 'var(--ax-font-mono)' }}
                        >
                          {formatKmf(row.total_collected_kmf)}
                        </td>
                        {/* Une correction n'est pas un incident : ton neutre,
                            jamais le rouge d'erreur. */}
                        <td
                          className="ax-table__td ax-table__td--num ax-num"
                          style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}
                        >
                          {formatKmf(row.total_reversed_kmf)}
                        </td>
                        <td
                          className="ax-table__td ax-table__td--num ax-num"
                          style={{
                            fontFamily: 'var(--ax-font-mono)',
                            fontWeight: 700,
                            color: 'var(--ax-text-strong)',
                          }}
                        >
                          {formatKmf(row.net_kmf)}
                        </td>
                        <td
                          className="ax-table__td ax-table__td--num ax-num"
                          style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}
                        >
                          {row.line_count}
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

      {modalOpen && (
        <GenerateExportModal
          onClose={() => setModalOpen(false)}
          onDone={(created) => {
            setModalOpen(false);
            setOutcome({
              notice: exportGeneratedNotice(created.number, created.line_count),
              previous: created.previous_export
                ? previousExportNotice(
                    created.previous_export.number,
                    created.previous_export.created_at,
                    created.previous_export.period_start,
                    created.previous_export.period_end,
                  )
                : null,
            });
            setPage(1);
            list.reload();
          }}
        />
      )}
    </>
  );
}

export default AccountingExports;
