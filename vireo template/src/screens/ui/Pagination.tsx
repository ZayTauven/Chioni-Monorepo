'use client';
/*
 * Vireo Next.js — UI · Pagination (route "ui/pagination").
 *
 * Faithful re-expression of src/html/ui/pagination.html: numbered + icon
 * controls, compact/pill/step pagers, a full summary + page-size bar, and a
 * live paginated orders table (Alpine page/size getters → useState + derived
 * view/from/to). DOM classes / ARIA / copy match the reference 1:1.
 */
import { useMemo, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const CHEV_L = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
);
const CHEV_R = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
);

interface Row { n: string; who: string; total: string; status: string; tone: string; }
const ROWS: Row[] = [
  { n: '10482', who: 'Camila Rossi', total: '$312.00', status: 'Shipped', tone: 'info' },
  { n: '10481', who: 'Henry Whitlock', total: '$129.00', status: 'Processing', tone: 'warning' },
  { n: '10480', who: 'Aisha Bello', total: '$80.00', status: 'Delivered', tone: 'success' },
  { n: '10479', who: 'Erik Lindqvist', total: '$1,544.00', status: 'Delivered', tone: 'success' },
  { n: '10478', who: 'Daniel Cho', total: '$24.00', status: 'Cancelled', tone: 'danger' },
  { n: '10477', who: 'Olivia Penrose', total: '$200.00', status: 'Delivered', tone: 'success' },
  { n: '10476', who: 'Sofia Marchetti', total: '$104.00', status: 'Shipped', tone: 'info' },
  { n: '10475', who: 'Yuki Tanaka', total: '$225.00', status: 'Pending', tone: 'warning' },
  { n: '10474', who: 'Rahul Menon', total: '$80.00', status: 'Delivered', tone: 'success' },
  { n: '10473', who: 'Nadia Haddad', total: '$238.00', status: 'Refunded', tone: 'danger' },
  { n: '10472', who: 'Greta Hoffmann', total: '$640.00', status: 'Delivered', tone: 'success' },
  { n: '10471', who: 'Mateo Alvarez', total: '$210.00', status: 'Processing', tone: 'warning' },
];

const STRONG_MONO: React.CSSProperties = { fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' };

export function Pagination() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(5);
  const pages = Math.ceil(ROWS.length / size);
  const view = useMemo(() => ROWS.slice(page * size, page * size + size), [page, size]);
  const from = ROWS.length ? page * size + 1 : 0;
  const to = Math.min((page + 1) * size, ROWS.length);
  const go = (p: number) => setPage(Math.max(0, Math.min(pages - 1, p)));

  return (
    <>
      <PageHead
        title="Pagination"
        subtitle="Page controls in every flavour — numbered, with icons, compact, with summary and a live table pager."
        actions={
          <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/list-group">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
            <span className="ax-btn__label">List groups</span>
          </a>
        }
      />

      <div className="ax-dash-grid">
        {/* BASIC + ICONS */}
        <section className="ax-card ax-col--6" role="region" aria-label="Basic and icon pagination">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Numbered</span>
              <h2 className="ax-card__title">Basic &amp; with icons</h2>
              <p className="ax-card__subtitle">Prev/next as text labels or as chevron icons, with an ellipsis gap.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <nav className="ax-pagination" aria-label="Search results, text controls">
              <button type="button" className="ax-pagination__prev" disabled aria-disabled="true">Previous</button>
              <ul className="ax-pagination__pages">
                <li><a className="ax-pagination__page" href="#" aria-current="page" aria-label="Page 1">1</a></li>
                <li><a className="ax-pagination__page" href="#" aria-label="Page 2">2</a></li>
                <li><a className="ax-pagination__page" href="#" aria-label="Page 3">3</a></li>
                <li aria-hidden="true"><span className="ax-pagination__ellipsis">…</span></li>
                <li><a className="ax-pagination__page" href="#" aria-label="Page 12">12</a></li>
              </ul>
              <button type="button" className="ax-pagination__next">Next</button>
            </nav>
            <nav className="ax-pagination" aria-label="Search results, icon controls">
              <button type="button" className="ax-pagination__prev" aria-label="Previous page">{CHEV_L}</button>
              <ul className="ax-pagination__pages">
                <li><a className="ax-pagination__page" href="#" aria-label="Page 1">1</a></li>
                <li><a className="ax-pagination__page" href="#" aria-label="Page 2">2</a></li>
                <li><a className="ax-pagination__page" href="#" aria-current="page" aria-label="Page 3">3</a></li>
                <li><a className="ax-pagination__page" href="#" aria-label="Page 4">4</a></li>
                <li><a className="ax-pagination__page" href="#" aria-label="Page 5">5</a></li>
                <li aria-hidden="true"><span className="ax-pagination__ellipsis">…</span></li>
                <li><a className="ax-pagination__page" href="#" aria-label="Page 24">24</a></li>
              </ul>
              <button type="button" className="ax-pagination__next" aria-label="Next page">{CHEV_R}</button>
            </nav>
            <nav className="ax-pagination" aria-label="Search results, first and last jumps">
              <button type="button" className="ax-pagination__prev" aria-label="First page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 7l-5 5l5 5" /><path d="M17 7l-5 5l5 5" /></svg></button>
              <button type="button" className="ax-pagination__prev" aria-label="Previous page">{CHEV_L}</button>
              <ul className="ax-pagination__pages">
                <li><a className="ax-pagination__page" href="#" aria-label="Page 6">6</a></li>
                <li><a className="ax-pagination__page" href="#" aria-current="page" aria-label="Page 7">7</a></li>
                <li><a className="ax-pagination__page" href="#" aria-label="Page 8">8</a></li>
              </ul>
              <button type="button" className="ax-pagination__next" aria-label="Next page">{CHEV_R}</button>
              <button type="button" className="ax-pagination__next" aria-label="Last page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7l5 5l-5 5" /><path d="M13 7l5 5l-5 5" /></svg></button>
            </nav>
          </div>
        </section>

        {/* COMPACT + PILL */}
        <section className="ax-card ax-col--6" role="region" aria-label="Compact pagination">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Minimal</span>
              <h2 className="ax-card__title">Compact &amp; pill</h2>
              <p className="ax-card__subtitle">Just position and arrows — for tight toolbars and cards.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <nav className="ax-pagination" aria-label="Compact pager">
              <button type="button" className="ax-pagination__prev" aria-label="Previous page">{CHEV_L}</button>
              <span className="ax-pagination__summary ax-num" aria-current="page" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>Page 3 of 24</span>
              <button type="button" className="ax-pagination__next" aria-label="Next page">{CHEV_R}</button>
            </nav>
            <nav className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }} aria-label="Pill pager">
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill ax-btn--sm" disabled aria-disabled="true">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
                <span className="ax-btn__label">Newer</span>
              </button>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill ax-btn--sm">
                <span className="ax-btn__label">Older</span>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
              </button>
            </nav>
            <nav className="ax-cluster" style={{ gap: 'var(--ax-space-2)', alignItems: 'center' }} aria-label="Step pager">
              <button type="button" className="ax-pagination__prev" aria-label="Previous step">{CHEV_L}</button>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }} role="group" aria-label="Step indicator">
                <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ax-border-strong)' }} />
                <i style={{ width: 22, height: 8, borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-accent)' }} />
                <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ax-border-strong)' }} />
                <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ax-border-strong)' }} />
              </span>
              <button type="button" className="ax-pagination__next" aria-label="Next step">{CHEV_R}</button>
            </nav>
          </div>
        </section>

        {/* WITH SUMMARY + PAGE SIZE */}
        <section className="ax-card ax-col--12" role="region" aria-label="Pagination with summary and page size">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Full bar</span>
              <h2 className="ax-card__title">With summary &amp; page size</h2>
              <p className="ax-card__subtitle">The complete table footer — result count, rows-per-page and numbered pages.</p>
            </div>
          </div>
          <div className="ax-card__body">
            <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-4)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)' }}>
                <span className="ax-pagination__summary ax-num">Showing <b style={STRONG_MONO}>21–40</b> of <b style={STRONG_MONO}>1,248</b></span>
                <label className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Rows
                  <select className="ax-select ax-select--sm" aria-label="Rows per page" defaultValue="20" style={{ width: 'auto' }}><option>10</option><option>20</option><option>50</option><option>100</option></select>
                </label>
              </div>
              <nav className="ax-pagination" aria-label="Transactions pages">
                <button type="button" className="ax-pagination__prev" aria-label="Previous page">{CHEV_L}</button>
                <ul className="ax-pagination__pages">
                  <li><a className="ax-pagination__page" href="#" aria-label="Page 1">1</a></li>
                  <li><a className="ax-pagination__page" href="#" aria-current="page" aria-label="Page 2">2</a></li>
                  <li><a className="ax-pagination__page" href="#" aria-label="Page 3">3</a></li>
                  <li><a className="ax-pagination__page" href="#" aria-label="Page 4">4</a></li>
                  <li aria-hidden="true"><span className="ax-pagination__ellipsis">…</span></li>
                  <li><a className="ax-pagination__page" href="#" aria-label="Page 63">63</a></li>
                </ul>
                <button type="button" className="ax-pagination__next" aria-label="Next page">{CHEV_R}</button>
              </nav>
            </div>
          </div>
        </section>

        {/* LIVE TABLE PAGER */}
        <section className="ax-card ax-col--12" role="region" aria-label="Live paginated orders table">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Interactive</span>
              <h2 className="ax-card__title">Recent orders — paged</h2>
              <p className="ax-card__subtitle">A working pager; page size updates the view live.</p>
            </div>
            <div className="ax-card__actions">
              <label className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Rows
                <select className="ax-select ax-select--sm" aria-label="Rows per page" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} style={{ width: 'auto' }}><option value={3}>3</option><option value={5}>5</option><option value={10}>10</option></select>
              </label>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Order</th>
                  <th className="ax-table__th" scope="col">Customer</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Total</th>
                  <th className="ax-table__th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {view.map((row) => (
                  <tr key={row.n} className="ax-table__row">
                    <td className="ax-table__td ax-num" style={STRONG_MONO}>#<span>{row.n}</span></td>
                    <td className="ax-table__td">{row.who}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-strong)' }}>{row.total}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--pill ax-badge--${row.tone}`}><span className="ax-badge__dot" /><span>{row.status}</span></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ax-card__footer" style={{ justifyContent: 'space-between' }}>
            <span className="ax-pagination__summary ax-num">Showing <b style={STRONG_MONO}>{from}</b>–<b style={STRONG_MONO}>{to}</b> of <b style={STRONG_MONO}>{ROWS.length}</b></span>
            <nav className="ax-pagination" aria-label="Orders pages">
              <button type="button" className="ax-pagination__prev" onClick={() => go(page - 1)} disabled={page === 0} aria-disabled={page === 0} aria-label="Previous page">{CHEV_L}</button>
              <ul className="ax-pagination__pages">
                {Array.from({ length: pages }).map((_, i) => {
                  const p = i + 1;
                  return (
                    <li key={p}><button type="button" className={`ax-pagination__page${page === i ? ' is-active' : ''}`} onClick={() => go(i)} aria-current={page === i ? 'page' : undefined} aria-label={`Page ${p}`}>{p}</button></li>
                  );
                })}
              </ul>
              <button type="button" className="ax-pagination__next" onClick={() => go(page + 1)} disabled={page === pages - 1} aria-disabled={page === pages - 1} aria-label="Next page">{CHEV_R}</button>
            </nav>
          </div>
        </section>
      </div>
    </>
  );
}

export default Pagination;
