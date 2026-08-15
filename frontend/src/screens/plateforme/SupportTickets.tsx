'use client';
/*
 * Chioni — /plateforme/tickets : la file de support, tous tenants (S5 lot 3).
 *
 * Base Vireo : la liste filtrable de `tables/DataTables`.
 *
 * Trois règles de cet écran, toutes venues du backend :
 *
 * 1. **`?open=true` est le filtre de travail** (`ouvert` + `en_cours`) : c'est
 *    l'état par défaut de la file, parce qu'un support ouvre son écran pour
 *    traiter, pas pour archiver.
 * 2. **Aucun humain n'est nommé** : `opened_by` est un id de compte, comme
 *    dans la file RGPD. L'interlocuteur est un CENTRE.
 * 3. **Le contenu est du texte libre écrit par un humain pressé.** Aucun champ
 *    ne relie un ticket à un patient (par conception), mais rien n'empêche
 *    quelqu'un d'écrire un nom dans le corps — donc pas de recherche plein
 *    texte ici, et ce contenu n'est recopié nulle part.
 *
 * Un ticket d'un tenant GELÉ arrive normalement dans cette file — c'est même
 * souvent le sujet du ticket.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import { listPlatformTickets } from '@/lib/endpoints/platform';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  formatDateTime,
  operatorAccountLabel,
} from '@/lib/labels';
import type { SupportCategory, SupportTicketStatus } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  IconChevronRight,
  Pagination,
  Ref,
  SUPPORT_PRIORITY_TONES,
  SUPPORT_TONES,
  StatusBadge,
  TableSkeleton,
  useAsync,
} from './shared';

export function PlatformSupportTickets() {
  // Défaut = la file de travail : ce qui attend une réponse.
  const [openOnly, setOpenOnly] = useState(true);
  const [status, setStatus] = useState<'' | SupportTicketStatus>('');
  const [category, setCategory] = useState<'' | SupportCategory>('');
  const [center, setCenter] = useState('');
  const [page, setPage] = useState(1);

  const centerId = Number.parseInt(center, 10);
  const tickets = useAsync(
    () =>
      listPlatformTickets({
        // `?open=` et `?status=` disent la même chose de deux façons : dès
        // qu'un état précis est demandé, il l'emporte.
        open: status ? undefined : openOnly ? true : undefined,
        status: status || undefined,
        category: category || undefined,
        center: Number.isFinite(centerId) ? centerId : undefined,
        page,
      }),
    [openOnly, status, category, center, page],
  );
  const rows = tickets.data?.results ?? [];

  return (
    <>
      <PlatformPageHead
        title="Support"
        subtitle="Les demandes des centres — répondre et faire avancer est le métier du support."
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="File des tickets">
          <div className="ax-card__body" style={{ paddingBottom: 'var(--ax-space-3)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="ax-field" style={{ minWidth: 200, flex: '1 1 200px' }}>
                <label className="ax-label" htmlFor="tk-status">
                  État
                </label>
                <select
                  id="tk-status"
                  className="ax-select ax-select--sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as '' | SupportTicketStatus);
                    setPage(1);
                  }}
                >
                  <option value="">Tous les états</option>
                  {SUPPORT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {SUPPORT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ax-field" style={{ minWidth: 220, flex: '1 1 220px' }}>
                <label className="ax-label" htmlFor="tk-category">
                  Sujet
                </label>
                <select
                  id="tk-category"
                  className="ax-select ax-select--sm"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as '' | SupportCategory);
                    setPage(1);
                  }}
                >
                  <option value="">Tous les sujets</option>
                  {SUPPORT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {SUPPORT_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ax-field" style={{ minWidth: 170 }}>
                <label className="ax-label" htmlFor="tk-center">
                  Centre (identifiant)
                </label>
                <input
                  id="tk-center"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="ax-input ax-input--sm"
                  value={center}
                  onChange={(e) => {
                    setCenter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tous"
                />
              </div>
              <div className="ax-field" style={{ minWidth: 210 }}>
                <label className="ax-label" htmlFor="tk-open">
                  File de travail
                </label>
                <label
                  className="ax-cluster"
                  htmlFor="tk-open"
                  style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', minHeight: 34 }}
                >
                  <input
                    id="tk-open"
                    type="checkbox"
                    className="ax-checkbox"
                    checked={openOnly}
                    disabled={status !== ''}
                    onChange={(e) => {
                      setOpenOnly(e.target.checked);
                      setPage(1);
                    }}
                  />
                  Ouverts et en cours seulement
                </label>
              </div>
            </div>
          </div>

          {tickets.loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : tickets.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={tickets.error} onRetry={tickets.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Rien à traiter"
              message={
                center
                  ? 'Aucun ticket pour cet identifiant de centre — vérifiez le numéro, ou retirez le filtre.'
                  : 'Aucune demande en attente sur ce filtre. C’est bon signe.'
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Objet</th>
                      <th className="ax-table__th" scope="col">Centre</th>
                      <th className="ax-table__th" scope="col">Sujet</th>
                      <th className="ax-table__th" scope="col">Dernier échange</th>
                      <th className="ax-table__th" scope="col">État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((ticket) => (
                      <tr key={ticket.id} className="ax-table__row">
                        <td className="ax-table__td">
                          <Link
                            href={`/plateforme/tickets/${ticket.id}`}
                            className="ax-link"
                            style={{ fontWeight: 'var(--ax-weight-medium)' }}
                          >
                            {ticket.subject}
                          </Link>
                          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                            {ticket.message_count} message{ticket.message_count > 1 ? 's' : ''}
                            {ticket.attachment_count > 0
                              ? ` · ${ticket.attachment_count} pièce${ticket.attachment_count > 1 ? 's' : ''} jointe${ticket.attachment_count > 1 ? 's' : ''}`
                              : ''}
                          </div>
                          <Ref>{operatorAccountLabel(ticket.opened_by)}</Ref>
                        </td>
                        <td className="ax-table__td">
                          <Link href={`/plateforme/centres/${ticket.center}`} className="ax-link">
                            {ticket.center_name}
                          </Link>
                          <div>
                            <Ref>centre #{ticket.center}</Ref>
                          </div>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {SUPPORT_CATEGORY_LABELS[ticket.category]}
                          {ticket.priority !== 'normale' && ticket.priority !== 'basse' && (
                            <div style={{ marginTop: 4 }}>
                              <StatusBadge
                                tone={SUPPORT_PRIORITY_TONES[ticket.priority]}
                                label={SUPPORT_PRIORITY_LABELS[ticket.priority]}
                              />
                            </div>
                          )}
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(ticket.last_message_at ?? ticket.created_at)}
                        </td>
                        <td className="ax-table__td">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
                            <StatusBadge
                              tone={SUPPORT_TONES[ticket.status]}
                              label={SUPPORT_STATUS_LABELS[ticket.status]}
                            />
                            <IconChevronRight className="" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tickets.data && <Pagination count={tickets.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>
    </>
  );
}

export default PlatformSupportTickets;
