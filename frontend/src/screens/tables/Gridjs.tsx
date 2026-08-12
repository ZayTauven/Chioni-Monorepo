'use client';
/*
 * Vireo Next.js — Grid.js (tables/gridjs). Faithful port of
 * src/html/tables/gridjs.html: the lightweight data-grid chrome — global search,
 * sortable columns & pagination — built on the shared .ax-table classes (the
 * reference uses no external Grid.js runtime; it's Alpine-driven, re-expressed
 * here with useState so pixels + behavior match 1:1).
 */
import { useMemo, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

type SortDir = 'asc' | 'desc';
interface Row {
  id: string; number: string; customer: string; initials: string; items: number;
  total: number; status: string; placed: string; daysAgo: number; c: string;
}
const C = {
  cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)',
  amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)', red: 'var(--ax-viz-red)',
};
const ROWS: Row[] = [
  { id: 'ord_10482', number: '10482', customer: 'Camila Rossi', initials: 'CR', items: 4, total: 312.0, status: 'Shipped', placed: '2h ago', daysAgo: 0, c: C.cyan },
  { id: 'ord_10481', number: '10481', customer: 'Henry Whitlock', initials: 'HW', items: 1, total: 129.0, status: 'Processing', placed: '5h ago', daysAgo: 0, c: C.violet },
  { id: 'ord_10480', number: '10480', customer: 'Aisha Bello', initials: 'AB', items: 3, total: 80.0, status: 'Delivered', placed: '1d ago', daysAgo: 1, c: C.emerald },
  { id: 'ord_10479', number: '10479', customer: 'Erik Lindqvist', initials: 'EL', items: 9, total: 1544.0, status: 'Delivered', placed: '2d ago', daysAgo: 2, c: C.amber },
  { id: 'ord_10478', number: '10478', customer: 'Daniel Cho', initials: 'DC', items: 1, total: 24.0, status: 'Cancelled', placed: '3d ago', daysAgo: 3, c: C.red },
  { id: 'ord_10477', number: '10477', customer: 'Olivia Penrose', initials: 'OP', items: 5, total: 200.0, status: 'Delivered', placed: '4d ago', daysAgo: 4, c: C.pink },
  { id: 'ord_10476', number: '10476', customer: 'Sofia Marchetti', initials: 'SM', items: 2, total: 104.0, status: 'Shipped', placed: '5d ago', daysAgo: 5, c: C.cyan },
  { id: 'ord_10475', number: '10475', customer: 'Yuki Tanaka', initials: 'YT', items: 5, total: 225.0, status: 'Pending', placed: '6d ago', daysAgo: 6, c: C.violet },
  { id: 'ord_10474', number: '10474', customer: 'Rahul Menon', initials: 'RM', items: 5, total: 80.0, status: 'Delivered', placed: '7d ago', daysAgo: 7, c: C.amber },
  { id: 'ord_10473', number: '10473', customer: 'Nadia Haddad', initials: 'NH', items: 3, total: 238.0, status: 'Refunded', placed: '8d ago', daysAgo: 8, c: C.pink },
  { id: 'ord_10472', number: '10472', customer: 'Greta Hoffmann', initials: 'GH', items: 2, total: 160.0, status: 'Delivered', placed: '9d ago', daysAgo: 9, c: C.emerald },
  { id: 'ord_10471', number: '10471', customer: 'Mateo Alvarez', initials: 'MA', items: 1, total: 44.0, status: 'Processing', placed: '10d ago', daysAgo: 10, c: C.cyan },
  { id: 'ord_10470', number: '10470', customer: 'Camila Rossi', initials: 'CR', items: 6, total: 498.0, status: 'Delivered', placed: '12d ago', daysAgo: 12, c: C.violet },
  { id: 'ord_10469', number: '10469', customer: 'Olivia Penrose', initials: 'OP', items: 2, total: 78.0, status: 'Shipped', placed: '14d ago', daysAgo: 14, c: C.pink },
  { id: 'ord_10468', number: '10468', customer: 'Erik Lindqvist', initials: 'EL', items: 8, total: 1280.0, status: 'Delivered', placed: '15d ago', daysAgo: 15, c: C.amber },
  { id: 'ord_10467', number: '10467', customer: 'Yuki Tanaka', initials: 'YT', items: 3, total: 172.0, status: 'Delivered', placed: '17d ago', daysAgo: 17, c: C.emerald },
];
const money = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusClass = (s: string) => (({ Delivered: 'ax-badge--success', Shipped: 'ax-badge--accent', Processing: 'ax-badge--info', Pending: 'ax-badge--warning', Cancelled: 'ax-badge--neutral', Refunded: 'ax-badge--danger' } as Record<string, string>)[s] || 'ax-badge--neutral');

const SortGlyph = ({ active, dir }: { active: boolean; dir: SortDir }) => {
  if (!active) return <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.4 }}><path d="M8 9l4 -4l4 4" /><path d="M16 15l-4 4l-4 -4" /></svg>;
  return dir === 'asc'
    ? <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
    : <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>;
};

export function Gridjs() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Row>('daysAgo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const perPage = 8;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = ROWS.filter((x) => !term || x.number.includes(term) || x.customer.toLowerCase().includes(term) || x.status.toLowerCase().includes(term));
    const dir = sortDir === 'asc' ? 1 : -1;
    r = [...r].sort((a, b) => {
      const va = a[sortKey]; const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return r;
  }, [q, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, (safePage - 1) * perPage + perPage);
  const rangeStart = filtered.length ? (safePage - 1) * perPage + 1 : 0;
  const rangeEnd = Math.min(safePage * perPage, filtered.length);
  const pageList = Array.from({ length: totalPages }, (_, i) => i + 1);

  const sortBy = (k: keyof Row) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
    setPage(1);
  };
  const ariaSort = (k: keyof Row): 'ascending' | 'descending' | 'none' => (sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');

  const Th = ({ k, label, num }: { k: keyof Row; label: string; num?: boolean }) => (
    <th className={`ax-table__th ax-table__th--sortable${num ? ' ax-table__th--num' : ''}`} scope="col" aria-sort={ariaSort(k)} onClick={() => sortBy(k)}>
      {label} <SortGlyph active={sortKey === k} dir={sortDir} />
    </th>
  );

  return (
    <>
      <PageHead
        title="Grid.js"
        subtitle="The lightweight data-grid chrome — global search, sortable columns &amp; pagination — token-bound so it re-themes with the rest of the app."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/tables/data-tables">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h6v6h-6z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6h-6z" /><path d="M14 14h6v6h-6z" /></svg>
              <span className="ax-btn__label">Full data table</span>
            </a>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Orders grid">
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Order Ledger</h2>
              <p className="ax-card__subtitle ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{filtered.length} results</p>
            </div>
            <div className="ax-card__actions">
              <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 300 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                <input type="search" className="ax-input ax-input--sm" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ paddingInlineStart: 34 }} aria-label="Search the grid" />
              </div>
            </div>
          </div>

          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover" style={{ minWidth: 720 }}>
              <caption className="ax-visually-hidden">Orders, sortable and searchable</caption>
              <thead className="ax-table__head">
                <tr>
                  <Th k="number" label="Order" />
                  <Th k="customer" label="Customer" />
                  <Th k="items" label="Items" num />
                  <Th k="total" label="Total" num />
                  <Th k="status" label="Status" />
                  <Th k="daysAgo" label="Placed" />
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} className="ax-table__row">
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-accent)', fontWeight: 'var(--ax-weight-semibold)' }}>#{r.number}</td>
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                        <span className="ax-avatar ax-avatar--sm" style={{ background: `color-mix(in oklab,${r.c} 18%,var(--ax-surface-solid))`, color: r.c }}><span className="ax-avatar__initials">{r.initials}</span></span>
                        <span className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{r.customer}</span>
                      </div>
                    </td>
                    <td className="ax-table__td ax-table__td--num">{r.items}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>{money(r.total)}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ${statusClass(r.status)}`}>{r.status}</span></td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{r.placed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!filtered.length && (
            <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg></span>
              <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No matches</h3>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>No rows match your search. Try a different term.</p>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => { setQ(''); setPage(1); }}>Clear search</button>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="ax-card__footer ax-flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>
                Showing {rangeStart} to {rangeEnd} of {filtered.length}
              </span>
              <nav className="ax-pagination" aria-label="Pagination">
                <button type="button" className="ax-pagination__prev" disabled={safePage === 1} aria-disabled={safePage === 1} onClick={() => setPage(Math.max(1, safePage - 1))} aria-label="Previous page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                <ul className="ax-pagination__pages">
                  {pageList.map((p) => (
                    <li key={p}>
                      <button type="button" className={`ax-pagination__page${safePage === p ? ' is-active' : ''}`} onClick={() => setPage(p)} aria-current={safePage === p ? 'page' : undefined}>{p}</button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="ax-pagination__next" disabled={safePage === totalPages} aria-disabled={safePage === totalPages} onClick={() => setPage(Math.min(totalPages, safePage + 1))} aria-label="Next page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </nav>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default Gridjs;
