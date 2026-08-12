'use client';
/*
 * Vireo Next.js — CRM / Companies (route "crm/companies").
 *
 * Faithful re-expression of src/html/crm/companies.html: the CRM sub-nav, a
 * 4-KPI row, then a searchable, industry-filtered, sortable accounts panel that
 * toggles between a table and a card grid, with bulk-select, a fixed-positioned
 * actions menu, status pills, an empty state, a paginated footer, and a
 * New-company modal. The Alpine x-data (axCompanies) is ported to React state;
 * classes + ARIA match the reference 1:1.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const C = {
  cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)',
  amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)',
};

interface Company {
  id: string; name: string; mark: string; domain: string; industry: string; size: number;
  deals: number; value: number; owner: string; ownerI: string; ownerC: string; status: string; c: string;
}
const ROWS: Company[] = [
  { id: 'co_01', name: 'Northwind Labs', mark: 'NW', domain: 'northwind.io', industry: 'SaaS', size: 240, deals: 6, value: 512000, owner: 'Maya Lindqvist', ownerI: 'ML', ownerC: C.emerald, status: 'Customer', c: C.cyan },
  { id: 'co_02', name: 'Brightline Capital', mark: 'BC', domain: 'brightline.co', industry: 'Fintech', size: 118, deals: 4, value: 386000, owner: 'Tomás Herrera', ownerI: 'TH', ownerC: C.violet, status: 'Prospect', c: C.violet },
  { id: 'co_03', name: 'Crate & Co', mark: 'CC', domain: 'crateco.com', industry: 'E-commerce', size: 64, deals: 3, value: 128400, owner: 'Ava Sutton', ownerI: 'AS', ownerC: C.emerald, status: 'Customer', c: C.amber },
  { id: 'co_04', name: 'Meridian Health', mark: 'MH', domain: 'meridianhealth.org', industry: 'Healthcare', size: 512, deals: 5, value: 441000, owner: 'Maya Lindqvist', ownerI: 'ML', ownerC: C.emerald, status: 'Negotiation', c: C.pink },
  { id: 'co_05', name: 'Studioform', mark: 'SF', domain: 'studioform.de', industry: 'Agency', size: 28, deals: 2, value: 64000, owner: 'Devon Okafor', ownerI: 'DO', ownerC: C.cyan, status: 'Prospect', c: C.emerald },
  { id: 'co_06', name: 'Loop Robotics', mark: 'LR', domain: 'looprobotics.com', industry: 'Manufacturing', size: 340, deals: 4, value: 298000, owner: 'Tomás Herrera', ownerI: 'TH', ownerC: C.violet, status: 'Customer', c: C.cyan },
  { id: 'co_07', name: 'Pulse Media', mark: 'PM', domain: 'pulse.media', industry: 'Agency', size: 46, deals: 1, value: 38000, owner: 'Ava Sutton', ownerI: 'AS', ownerC: C.emerald, status: 'At risk', c: C.violet },
  { id: 'co_08', name: 'Harbor Freight Co', mark: 'HF', domain: 'harborfreight.co', industry: 'E-commerce', size: 156, deals: 3, value: 174000, owner: 'Devon Okafor', ownerI: 'DO', ownerC: C.cyan, status: 'Customer', c: C.amber },
  { id: 'co_09', name: 'Ridgeline Energy', mark: 'RE', domain: 'ridgeline.energy', industry: 'Manufacturing', size: 780, deals: 2, value: 206000, owner: 'Maya Lindqvist', ownerI: 'ML', ownerC: C.emerald, status: 'Negotiation', c: C.pink },
  { id: 'co_10', name: 'Clearbox', mark: 'CB', domain: 'clearbox.app', industry: 'SaaS', size: 92, deals: 5, value: 221500, owner: 'Tomás Herrera', ownerI: 'TH', ownerC: C.violet, status: 'Prospect', c: C.cyan },
  { id: 'co_11', name: 'Postoak Insurance', mark: 'PI', domain: 'postoak.com', industry: 'Fintech', size: 430, deals: 3, value: 158000, owner: 'Ava Sutton', ownerI: 'AS', ownerC: C.emerald, status: 'Customer', c: C.emerald },
  { id: 'co_12', name: 'Meadow Foods', mark: 'MF', domain: 'meadowfoods.co', industry: 'E-commerce', size: 210, deals: 2, value: 84000, owner: 'Devon Okafor', ownerI: 'DO', ownerC: C.cyan, status: 'At risk', c: C.amber },
];

const PER_PAGE = 8;
const money = (v: number) => (v >= 1000 ? '$' + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'K' : '$' + v);
const statusClass = (s: string) => ({ Customer: 'ax-badge--success', Prospect: 'ax-badge--info', Negotiation: 'ax-badge--accent', 'At risk': 'ax-badge--danger' } as Record<string, string>)[s] || 'ax-badge--neutral';

function SortGlyph({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }): ReactElement {
  if (!active) return <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.4 }}><path d="M8 9l4 -4l4 4" /><path d="M16 15l-4 4l-4 -4" /></svg>;
  return dir === 'asc'
    ? <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
    : <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>;
}

export function Companies() {
  const [q, setQ] = useState('');
  const [fIndustry, setFIndustry] = useState('');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<'name' | 'deals' | 'value'>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = ROWS.filter((x) => {
      if (fIndustry && x.industry !== fIndustry) return false;
      if (t && !(x.name.toLowerCase().includes(t) || x.owner.toLowerCase().includes(t) || x.domain.toLowerCase().includes(t))) return false;
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...r].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      return typeof va === 'number' && typeof vb === 'number' ? (va - vb) * dir : String(va).localeCompare(String(vb)) * dir;
    });
  }, [q, fIndustry, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const rangeStart = filtered.length ? (safePage - 1) * PER_PAGE + 1 : 0;
  const rangeEnd = Math.min(safePage * PER_PAGE, filtered.length);

  const pageList = (): (number | '…')[] => {
    const tp = totalPages, p = safePage, out: (number | '…')[] = [];
    if (tp <= 7) { for (let i = 1; i <= tp; i++) out.push(i); return out; }
    out.push(1); if (p > 3) out.push('…');
    for (let i = Math.max(2, p - 1); i <= Math.min(tp - 1, p + 1); i++) out.push(i);
    if (p < tp - 2) out.push('…'); out.push(tp); return out;
  };

  const sortBy = (k: 'name' | 'deals' | 'value') => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
    setPage(1);
  };
  const ariaSort = (k: string): 'ascending' | 'descending' | 'none' => (sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');

  const pagedIds = paged.map((r) => r.id);
  const allSelected = pagedIds.length > 0 && pagedIds.every((id) => selected.includes(id));
  const someSelected = pagedIds.filter((id) => selected.includes(id)).length > 0 && !allSelected;
  const toggleAll = (on: boolean) => setSelected((s) => (on ? [...new Set([...s, ...pagedIds])] : s.filter((id) => !pagedIds.includes(id))));
  const toggleSel = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleMenu = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (menu?.id === id) { setMenu(null); return; }
    const b = e.currentTarget.getBoundingClientRect();
    const de = document.documentElement, vw = de.clientWidth;
    const rtl = de.getAttribute('dir') === 'rtl';
    setMenu({ id, x: Math.max(8, rtl ? b.left : vw - b.right), y: b.bottom + 4 });
  };

  return (
    <>
      <PageHead
        title="Companies"
        subtitle={(<><span className="ax-num">{ROWS.length}</span> accounts in your pipeline — <span className="ax-num">$2.84M</span> open deal value.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setAddOpen(true)}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New company</span>
            </button>
          </>
        }
      />

      {/* CRM SUB-NAV */}
      <nav className="ax-tabs ax-tabs--pill" aria-label="CRM sections" style={{ marginBottom: 'var(--ax-space-5)' }}>
        <div className="ax-tabs__list" role="tablist">
          <a className="ax-tabs__tab" role="tab" href="/crm/contacts">Contacts</a>
          <a className="ax-tabs__tab is-active" role="tab" aria-selected="true" aria-current="page" href="/crm/companies">Companies</a>
          <a className="ax-tabs__tab" role="tab" href="/crm/deals">Deals</a>
          <a className="ax-tabs__tab" role="tab" href="/crm/leads">Leads</a>
        </div>
      </nav>

      {/* KPI ROW */}
      <div className="ax-dash-grid" style={{ marginBottom: 'var(--ax-space-6)' }}>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Total companies">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h18" /><path d="M9 8h1" /><path d="M9 12h1" /><path d="M9 16h1" /><path d="M14 8h1" /><path d="M14 12h1" /><path d="M14 16h1" /><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>6.2%</span>
            </div>
            <div className="ax-kpi__label">Total Companies</div>
            <div className="ax-kpi__value ax-num">128</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Active accounts">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2l4 -4" /><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>4.1%</span>
            </div>
            <div className="ax-kpi__label">Active Accounts</div>
            <div className="ax-kpi__value ax-num">94</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Open deal value">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>9.8%</span>
            </div>
            <div className="ax-kpi__label">Open Deal Value</div>
            <div className="ax-kpi__value ax-num">$2.84M</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Churn risk">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--down"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>1.4%</span>
            </div>
            <div className="ax-kpi__label">At Churn Risk</div>
            <div className="ax-kpi__value ax-num">7</div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Companies table">
          {/* toolbar */}
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div className="ax-card__titles">
              <h2 className="ax-card__title">All Companies</h2>
              <p className="ax-card__subtitle ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                <span>{filtered.length}</span> of <span>{ROWS.length}</span> shown
              </p>
            </div>
            <div className="ax-card__actions" style={{ flex: '1 1 auto', flexWrap: 'wrap', gap: 'var(--ax-space-2)', minWidth: 0 }}>
              <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 300 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                <input type="search" className="ax-input ax-input--sm" placeholder="Search company or owner…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ paddingInlineStart: 34 }} aria-label="Search companies" />
              </div>
              <select className="ax-select ax-select--sm" value={fIndustry} onChange={(e) => { setFIndustry(e.target.value); setPage(1); }} aria-label="Filter by industry" style={{ minWidth: 150 }}>
                <option value="">All industries</option>
                <option>SaaS</option>
                <option>Fintech</option>
                <option>E-commerce</option>
                <option>Healthcare</option>
                <option>Manufacturing</option>
                <option>Agency</option>
              </select>
              <div className="ax-segment" role="group" aria-label="View mode" style={{ marginInlineStart: 'auto' }}>
                <button type="button" className={`ax-segment__option ax-btn--icon${view === 'table' ? ' is-active' : ''}`} aria-checked={view === 'table'} onClick={() => setView('table')} aria-label="Table view"><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></button>
                <button type="button" className={`ax-segment__option ax-btn--icon${view === 'grid' ? ' is-active' : ''}`} aria-checked={view === 'grid'} onClick={() => setView('grid')} aria-label="Card view"><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h6v6h-6z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6h-6z" /><path d="M14 14h6v6h-6z" /></svg></button>
              </div>
            </div>
          </div>

          {/* bulk bar */}
          {!!selected.length && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', margin: '0 var(--ax-space-5) var(--ax-space-3)', padding: 'var(--ax-space-2) var(--ax-space-4)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-accent)', borderRadius: 'var(--ax-radius-md)', flexWrap: 'wrap' }}>
              <b className="ax-num" style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-sm)' }}><span>{selected.length}</span> selected</b>
              <span style={{ width: 1, height: 18, background: 'var(--ax-border-strong)' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Assign owner</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Add tag</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Export</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ color: 'var(--ax-danger-500)' }}>Archive</button>
              <span style={{ flex: '1 1 auto' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Clear selection" onClick={() => setSelected([])}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
          )}

          {/* TABLE VIEW */}
          {view === 'table' && (
            <div className="ax-table-wrap">
              <table className="ax-table ax-table--hover" style={{ minWidth: 880 }}>
                <caption className="ax-visually-hidden">Companies, sortable and searchable</caption>
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col" style={{ width: 38 }}><input type="checkbox" className="ax-checkbox" aria-label="Select all rows on this page" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected; }} onChange={(e) => toggleAll(e.target.checked)} /></th>
                    <th className="ax-table__th ax-table__th--sortable" scope="col" aria-sort={ariaSort('name')} onClick={() => sortBy('name')}>Company <SortGlyph active={sortKey === 'name'} dir={sortDir} /></th>
                    <th className="ax-table__th" scope="col">Industry</th>
                    <th className="ax-table__th ax-table__th--sortable ax-table__th--num" scope="col" aria-sort={ariaSort('deals')} onClick={() => sortBy('deals')}>Deals <SortGlyph active={sortKey === 'deals'} dir={sortDir} /></th>
                    <th className="ax-table__th ax-table__th--sortable ax-table__th--num" scope="col" aria-sort={ariaSort('value')} onClick={() => sortBy('value')}>Open value <SortGlyph active={sortKey === 'value'} dir={sortDir} /></th>
                    <th className="ax-table__th" scope="col">Owner</th>
                    <th className="ax-table__th" scope="col">Status</th>
                    <th className="ax-table__th" scope="col" style={{ width: 44 }}><span className="ax-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r) => (
                    <tr key={r.id} className="ax-table__row" style={selected.includes(r.id) ? { background: 'var(--ax-accent-wash)' } : undefined}>
                      <td className="ax-table__td"><input type="checkbox" className="ax-checkbox" checked={selected.includes(r.id)} onChange={() => toggleSel(r.id)} aria-label={'Select ' + r.name} /></td>
                      <td className="ax-table__td">
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                          <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${r.c} 18%,transparent)`, color: r.c, fontWeight: 700 }}><span>{r.mark}</span></span>
                          <div style={{ minWidth: 0 }}>
                            <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{r.name}</div>
                            <div className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)' }}>{r.domain}</div>
                          </div>
                        </div>
                      </td>
                      <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">{r.industry}</span></td>
                      <td className="ax-table__td ax-table__td--num">{r.deals}</td>
                      <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>{money(r.value)}</td>
                      <td className="ax-table__td">
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                          <span className="ax-avatar ax-avatar--xs ax-avatar--squircle" style={{ background: `color-mix(in oklab,${r.ownerC} 20%,transparent)`, color: r.ownerC, fontWeight: 600, fontSize: 9, borderRadius: 6 }}>{r.ownerI}</span>
                          <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>{r.owner}</span>
                        </div>
                      </td>
                      <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--pill ax-badge--sm ${statusClass(r.status)}`}><span className="ax-badge__dot" /><span>{r.status}</span></span></td>
                      <td className="ax-table__td" style={{ textAlign: 'end' }}>
                        <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={(e) => toggleMenu(r.id, e)} aria-expanded={menu?.id === r.id} aria-haspopup="menu" aria-label="Row actions"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M17 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD VIEW */}
          {view === 'grid' && (
            <div className="ax-card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 'var(--ax-space-5)' }}>
              {paged.map((r) => (
                <article key={r.id} className="ax-card ax-card--interactive" style={{ margin: 0 }}>
                  <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', justifyContent: 'space-between' }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', minWidth: 0 }}>
                        <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: `color-mix(in oklab,${r.c} 18%,transparent)`, color: r.c, fontWeight: 700 }}><b style={{ fontSize: 'var(--ax-text-md)' }}>{r.mark}</b></span>
                        <div style={{ minWidth: 0 }}>
                          <div className="ax-text-truncate" style={{ fontWeight: 600, color: 'var(--ax-text-strong)' }}>{r.name}</div>
                          <div className="ax-num ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)' }}>{r.domain}</div>
                        </div>
                      </div>
                      <span className={`ax-badge ax-badge--soft ax-badge--pill ax-badge--sm ${statusClass(r.status)}`}><span className="ax-badge__dot" /><span>{r.status}</span></span>
                    </div>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                      <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">{r.industry}</span>
                      <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">{r.size + ' staff'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)', paddingTop: 'var(--ax-space-1)', borderTop: '1px solid var(--ax-border)' }}>
                      <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Open deals</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>{r.deals}</b></div>
                      <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Value</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>{money(r.value)}</b></div>
                    </div>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'space-between' }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                        <span className="ax-avatar ax-avatar--xs ax-avatar--squircle" style={{ background: `color-mix(in oklab,${r.ownerC} 20%,transparent)`, color: r.ownerC, fontWeight: 600, fontSize: 9, borderRadius: 6 }}>{r.ownerI}</span>
                        <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>{r.owner}</span>
                      </div>
                      <a className="ax-btn ax-btn--link ax-btn--sm" href="#">Open →</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* empty */}
          {!filtered.length && (
            <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M3 21h18" /><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16" /><path d="M9 8h1m4 0h1m-6 4h1m4 0h1" /></svg></span>
              <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No companies found</h3>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>No accounts match your search and filters.</p>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => { setQ(''); setFIndustry(''); setPage(1); }}>Clear filters</button>
            </div>
          )}

          {/* footer */}
          {!!filtered.length && (
            <div className="ax-card__footer ax-flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>
                Showing <span>{rangeStart}</span>–<span>{rangeEnd}</span> of <span>{filtered.length}</span>
              </span>
              <nav className="ax-pagination" aria-label="Pagination">
                <button type="button" className="ax-pagination__prev" disabled={safePage === 1} aria-disabled={safePage === 1} onClick={() => setPage(Math.max(1, safePage - 1))} aria-label="Previous page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                <ul className="ax-pagination__pages">
                  {pageList().map((p, i) => (
                    <li key={i}>
                      {p === '…' ? <span className="ax-pagination__ellipsis">…</span>
                        : <button type="button" className={`ax-pagination__page${safePage === p ? ' is-active' : ''}`} aria-current={safePage === p ? 'page' : undefined} onClick={() => setPage(p)}>{p}</button>}
                    </li>
                  ))}
                </ul>
                <button type="button" className="ax-pagination__next" disabled={safePage === totalPages} aria-disabled={safePage === totalPages} onClick={() => setPage(Math.min(totalPages, safePage + 1))} aria-label="Next page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </nav>
            </div>
          )}
        </section>
      </div>

      {/* ROW ACTIONS MENU */}
      {menu !== null && (
        <>
          <button type="button" aria-hidden="true" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'transparent', border: 0, cursor: 'default' }} onClick={() => setMenu(null)} />
          <div className="ax-menu" role="menu" style={{ position: 'fixed', top: menu.y, insetInlineEnd: menu.x, zIndex: 60, minWidth: 170 }}>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>View account</button>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>Edit</button>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>Add deal</button>
            <div className="ax-menu__divider" role="separator" />
            <button type="button" className="ax-menu__item ax-menu__item--danger" role="menuitem" onClick={() => setMenu(null)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>Archive</button>
          </div>
        </>
      )}

      {/* NEW COMPANY MODAL */}
      {addOpen && (
        <div onKeyDown={(e) => { if (e.key === 'Escape') setAddOpen(false); }}>
          <button type="button" aria-hidden="true" tabIndex={-1} className="ax-backdrop" onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.4)', border: 0 }} />
          <div className="ax-flex" role="dialog" aria-modal="true" aria-label="New company" style={{ position: 'fixed', inset: 0, zIndex: 51, alignItems: 'center', justifyContent: 'center', padding: 'var(--ax-space-4)' }}>
            <form className="ax-card" onSubmit={(e) => { e.preventDefault(); setAddOpen(false); }} onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px,100%)', maxHeight: '90vh', overflow: 'auto' }}>
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">New company</h2></div>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setAddOpen(false)} aria-label="Close"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field"><label className="ax-label" htmlFor="co-name">Company name</label><input id="co-name" type="text" className="ax-input" placeholder="Northwind Labs" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="co-domain">Domain</label><input id="co-domain" type="text" className="ax-input" placeholder="northwind.io" /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="co-ind">Industry</label><select id="co-ind" className="ax-select"><option>SaaS</option><option>Fintech</option><option>E-commerce</option><option>Healthcare</option><option>Manufacturing</option><option>Agency</option></select></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="co-size">Headcount</label><input id="co-size" type="number" className="ax-input" placeholder="120" /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="co-owner">Account owner</label><select id="co-owner" className="ax-select"><option>Maya Lindqvist</option><option>Devon Okafor</option><option>Tomás Herrera</option><option>Ava Sutton</option></select></div>
                </div>
              </div>
              <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)' }}>
                <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setAddOpen(false)}>Cancel</button>
                <button type="submit" className="ax-btn ax-btn--primary">Create company</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Companies;
