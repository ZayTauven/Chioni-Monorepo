'use client';
/*
 * Vireo Next.js — CRM / Leads (route "crm/leads").
 *
 * Faithful re-expression of src/html/crm/leads.html: a status-funnel KPI strip
 * over a searchable, source/status-filtered, sortable leads table with
 * bulk-select, status filter chips, a per-row actions menu (fixed-positioned,
 * anchored to its trigger), score bars, convert action + toast, an empty state,
 * paginated footer, and a New-lead modal. The Alpine x-data (axLeads) + teleported
 * menu are ported to React state; classes + ARIA match the reference 1:1.
 */
import { useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = {
  cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)',
  amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)',
};

const SRC_PATH: Record<string, string[]> = {
  Website: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M3.6 9h16.8', 'M3.6 15h16.8', 'M11.5 3a17 17 0 0 0 0 18', 'M12.5 3a17 17 0 0 1 0 18'],
  Referral: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  'Cold outreach': ['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10', 'M3 7l9 6l9 -6'],
  Event: ['M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12', 'M16 3l0 4', 'M8 3l0 4', 'M4 11l16 0'],
  'Paid ads': ['M10 14a3.5 3.5 0 0 0 5 0l4 -4a3.5 3.5 0 0 0 -5 -5l-.5 .5', 'M14 10a3.5 3.5 0 0 0 -5 0l-4 4a3.5 3.5 0 0 0 5 5l.5 -.5'],
  Webinar: ['M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z', 'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'],
};
const srcColor: Record<string, string> = {
  Website: C.cyan, Referral: C.emerald, 'Cold outreach': C.violet, Event: C.amber, 'Paid ads': C.pink, Webinar: C.cyan,
};

interface Lead {
  id: string; name: string; title: string; company: string; initials: string; c: string;
  score: number; source: string; status: string; assigned: boolean; owner: string;
  ownerI: string; ownerC: string; added: string; addedDays: number;
}
const ROWS: Lead[] = [
  { id: 'l01', name: 'Jordan Avery', title: 'Ops Director', company: 'Vantage Retail', initials: 'JA', c: C.cyan, score: 92, source: 'Referral', status: 'Qualified', assigned: true, owner: 'Maya Lindqvist', ownerI: 'ML', ownerC: C.emerald, added: 'Jun 26', addedDays: 2 },
  { id: 'l02', name: 'Priya Anand', title: 'Head of IT', company: 'Solstice Bank', initials: 'PA', c: C.violet, score: 88, source: 'Website', status: 'Contacted', assigned: true, owner: 'Tomás Herrera', ownerI: 'TH', ownerC: C.violet, added: 'Jun 25', addedDays: 3 },
  { id: 'l03', name: 'Marcus Webb', title: 'Founder', company: 'Tidal Apps', initials: 'MW', c: C.amber, score: 81, source: 'Event', status: 'Qualified', assigned: true, owner: 'Ava Sutton', ownerI: 'AS', ownerC: C.emerald, added: 'Jun 24', addedDays: 4 },
  { id: 'l04', name: 'Elena Vasquez', title: 'VP Marketing', company: 'Brightpath', initials: 'EV', c: C.pink, score: 76, source: 'Webinar', status: 'New', assigned: false, owner: '', ownerI: '', ownerC: '', added: 'Jun 27', addedDays: 1 },
  { id: 'l05', name: 'Tobias Frank', title: 'CTO', company: 'Greycliff', initials: 'TF', c: C.emerald, score: 69, source: 'Cold outreach', status: 'Contacted', assigned: true, owner: 'Devon Okafor', ownerI: 'DO', ownerC: C.cyan, added: 'Jun 23', addedDays: 5 },
  { id: 'l06', name: 'Hana Suzuki', title: 'Procurement', company: 'Kaiyo Trading', initials: 'HS', c: C.cyan, score: 64, source: 'Website', status: 'New', assigned: false, owner: '', ownerI: '', ownerC: '', added: 'Jun 27', addedDays: 1 },
  { id: 'l07', name: 'Liam Doherty', title: 'Sales Lead', company: 'Foundry Co', initials: 'LD', c: C.violet, score: 58, source: 'Paid ads', status: 'Contacted', assigned: true, owner: 'Ava Sutton', ownerI: 'AS', ownerC: C.emerald, added: 'Jun 22', addedDays: 6 },
  { id: 'l08', name: 'Nina Kovač', title: 'Operations', company: 'Adriatic Foods', initials: 'NK', c: C.amber, score: 52, source: 'Referral', status: 'Qualified', assigned: true, owner: 'Maya Lindqvist', ownerI: 'ML', ownerC: C.emerald, added: 'Jun 21', addedDays: 7 },
  { id: 'l09', name: 'Omar Reyes', title: 'IT Manager', company: 'Cobalt Systems', initials: 'OR', c: C.pink, score: 44, source: 'Cold outreach', status: 'New', assigned: false, owner: '', ownerI: '', ownerC: '', added: 'Jun 26', addedDays: 2 },
  { id: 'l10', name: 'Sienna Blake', title: 'Buyer', company: 'Lumen Decor', initials: 'SB', c: C.emerald, score: 38, source: 'Paid ads', status: 'Unqualified', assigned: true, owner: 'Devon Okafor', ownerI: 'DO', ownerC: C.cyan, added: 'Jun 18', addedDays: 10 },
  { id: 'l11', name: 'Felix Norén', title: 'Founder', company: 'Norden Studio', initials: 'FN', c: C.cyan, score: 71, source: 'Event', status: 'Contacted', assigned: true, owner: 'Tomás Herrera', ownerI: 'TH', ownerC: C.violet, added: 'Jun 24', addedDays: 4 },
  { id: 'l12', name: 'Carla Mendes', title: 'COO', company: 'Verde Logistics', initials: 'CM', c: C.violet, score: 29, source: 'Website', status: 'Unqualified', assigned: false, owner: '', ownerI: '', ownerC: '', added: 'Jun 15', addedDays: 13 },
];

const PER_PAGE = 8;
const scoreColor = (v: number) => (v >= 75 ? 'var(--ax-success-500)' : v >= 50 ? 'var(--ax-warning-500)' : 'var(--ax-danger-500)');
const statusClass = (s: string) => ({ New: 'ax-badge--info', Contacted: 'ax-badge--accent', Qualified: 'ax-badge--success', Unqualified: 'ax-badge--danger' } as Record<string, string>)[s] || 'ax-badge--neutral';

function SortGlyph({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }): ReactElement {
  if (!active) return <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.4 }}><path d="M8 9l4 -4l4 4" /><path d="M16 15l-4 4l-4 -4" /></svg>;
  return dir === 'asc'
    ? <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
    : <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>;
}

const STATUSES = ['All', 'New', 'Contacted', 'Qualified', 'Unqualified'];

export function Leads() {
  const [rows, setRows] = useState<Lead[]>(ROWS);
  const [q, setQ] = useState('');
  const [fSource, setFSource] = useState('');
  const [fStatus, setFStatus] = useState('All');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<'name' | 'score' | 'addedDays'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState('');

  const countStatus = (s: string) => (s === 'All' ? rows.length : rows.filter((r) => r.status === s).length);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = rows.filter((x) => {
      if (fSource && x.source !== fSource) return false;
      if (fStatus !== 'All' && x.status !== fStatus) return false;
      if (t && !(x.name.toLowerCase().includes(t) || x.company.toLowerCase().includes(t) || x.source.toLowerCase().includes(t))) return false;
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...r].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      return typeof va === 'number' && typeof vb === 'number' ? (va - vb) * dir : String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, q, fSource, fStatus, sortKey, sortDir]);

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

  const sortBy = (k: 'name' | 'score' | 'addedDays') => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'score' ? 'desc' : 'asc'); }
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

  const showToast = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(''), 3200); };
  const convert = (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (!r || r.status === 'Unqualified') return;
    setRows((rs) => rs.filter((x) => x.id !== id));
    setSelected((s) => s.filter((x) => x !== id));
    setMenu(null);
    showToast(`${r.name} converted to a deal`);
  };
  const disqualify = (id: string) => {
    setRows((rs) => rs.map((x) => (x.id === id ? { ...x, status: 'Unqualified' } : x)));
    setMenu(null);
  };

  return (
    <>
      <PageHead
        title="Leads"
        subtitle={(<><span className="ax-num">{rows.length}</span> inbound leads this month — <span className="ax-num">31%</span> qualification rate, avg score <span className="ax-num">68</span>.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setAddOpen(true)}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New lead</span>
            </button>
          </>
        }
      />

      {/* CRM SUB-NAV */}
      <nav className="ax-tabs ax-tabs--pill" aria-label="CRM sections" style={{ marginBottom: 'var(--ax-space-5)' }}>
        <div className="ax-tabs__list" role="tablist">
          <Link className="ax-tabs__tab" role="tab" href="/crm/contacts">Contacts</Link>
          <Link className="ax-tabs__tab" role="tab" href="/crm/companies">Companies</Link>
          <Link className="ax-tabs__tab" role="tab" href="/crm/deals">Deals</Link>
          <Link className="ax-tabs__tab is-active" role="tab" aria-selected="true" aria-current="page" href="/crm/leads">Leads</Link>
        </div>
      </nav>

      {/* STATUS FUNNEL KPIs */}
      <div className="ax-dash-grid" style={{ marginBottom: 'var(--ax-space-6)' }}>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="New leads">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2l4 -4" /><path d="M3.06 12a9 9 0 1 0 .96 -4" /><path d="M3 4.5v3.5h3.5" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>18%</span>
            </div>
            <div className="ax-kpi__label">New</div>
            <div className="ax-kpi__value ax-num">24</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Contacted leads">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>9%</span>
            </div>
            <div className="ax-kpi__label">Contacted</div>
            <div className="ax-kpi__value ax-num">17</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Qualified leads">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>12%</span>
            </div>
            <div className="ax-kpi__label">Qualified</div>
            <div className="ax-kpi__value ax-num">11</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Converted leads">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /><path d="M12 13l0 9" /><path d="M9 16l3 -3l3 3" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>6%</span>
            </div>
            <div className="ax-kpi__label">Converted</div>
            <div className="ax-kpi__value ax-num">7</div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Leads table">
          {/* toolbar */}
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div className="ax-card__titles">
              <h2 className="ax-card__title">All Leads</h2>
              <p className="ax-card__subtitle ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                <span>{filtered.length}</span> of <span>{rows.length}</span> shown
              </p>
            </div>
            <div className="ax-card__actions" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
              <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 300 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                <input type="search" className="ax-input ax-input--sm" placeholder="Search name, company or source…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ paddingInlineStart: 34 }} aria-label="Search leads" />
              </div>
              <select className="ax-select ax-select--sm" value={fSource} onChange={(e) => { setFSource(e.target.value); setPage(1); }} aria-label="Filter by source" style={{ minWidth: 150 }}>
                <option value="">All sources</option>
                <option>Website</option>
                <option>Referral</option>
                <option>Cold outreach</option>
                <option>Event</option>
                <option>Paid ads</option>
                <option>Webinar</option>
              </select>
            </div>
          </div>

          {/* status filter chips */}
          <div className="ax-card__body" style={{ paddingTop: 0, paddingBottom: 'var(--ax-space-4)' }}>
            <div className="ax-cluster" style={{ gap: 6, flexWrap: 'wrap' }}>
              {STATUSES.map((s) => (
                <button key={s} type="button" className={`ax-badge ax-badge--pill ax-badge--filter ${fStatus === s ? 'ax-badge--accent' : 'ax-badge--soft ax-badge--neutral'}`} onClick={() => { setFStatus(s); setPage(1); }} aria-pressed={fStatus === s}>
                  <span>{s}</span>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', opacity: 0.7 }}>{'· ' + countStatus(s)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* bulk bar */}
          {!!selected.length && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', margin: 'var(--ax-space-3) var(--ax-space-5)', padding: 'var(--ax-space-2) var(--ax-space-4)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-accent)', borderRadius: 'var(--ax-radius-md)', flexWrap: 'wrap' }}>
              <b className="ax-num" style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-sm)' }}><span>{selected.length}</span> selected</b>
              <span style={{ width: 1, height: 18, background: 'var(--ax-border-strong)' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Assign</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Set status</button>
              <button type="button" className="ax-btn ax-btn--soft-success ax-btn--sm">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /><path d="M12 13l0 9" /><path d="M9 16l3 -3l3 3" /></svg>
                <span className="ax-btn__label">Convert</span>
              </button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ color: 'var(--ax-danger-500)' }}>Disqualify</button>
              <span style={{ flex: '1 1 auto' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Clear selection" onClick={() => setSelected([])}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
          )}

          {/* table */}
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover" style={{ minWidth: 980 }}>
              <caption className="ax-visually-hidden">Leads, sortable and searchable</caption>
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col" style={{ width: 38 }}><input type="checkbox" className="ax-checkbox" aria-label="Select all rows on this page" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected; }} onChange={(e) => toggleAll(e.target.checked)} /></th>
                  <th className="ax-table__th ax-table__th--sortable" scope="col" aria-sort={ariaSort('name')} onClick={() => sortBy('name')}>Lead <SortGlyph active={sortKey === 'name'} dir={sortDir} /></th>
                  <th className="ax-table__th ax-table__th--sortable ax-table__th--num" scope="col" aria-sort={ariaSort('score')} onClick={() => sortBy('score')}>Score <SortGlyph active={sortKey === 'score'} dir={sortDir} /></th>
                  <th className="ax-table__th" scope="col">Source</th>
                  <th className="ax-table__th" scope="col">Status</th>
                  <th className="ax-table__th" scope="col">Assigned</th>
                  <th className="ax-table__th ax-table__th--sortable" scope="col" aria-sort={ariaSort('addedDays')} onClick={() => sortBy('addedDays')}>Added <SortGlyph active={sortKey === 'addedDays'} dir={sortDir} /></th>
                  <th className="ax-table__th" scope="col" style={{ width: 160 }}><span className="ax-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} className="ax-table__row" style={selected.includes(r.id) ? { background: 'var(--ax-accent-wash)' } : undefined}>
                    <td className="ax-table__td"><input type="checkbox" className="ax-checkbox" checked={selected.includes(r.id)} onChange={() => toggleSel(r.id)} aria-label={'Select ' + r.name} /></td>
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                        <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${r.c} 18%,transparent)`, color: r.c, fontWeight: 700 }}><span style={{ fontSize: 10 }}>{r.initials}</span></span>
                        <div style={{ minWidth: 0 }}>
                          <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{r.name}</div>
                          <div className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{r.title + ' · ' + r.company}</div>
                        </div>
                      </div>
                    </td>
                    <td className="ax-table__td ax-table__td--num">
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: scoreColor(r.score) }}>{r.score}</span>
                        <span className="ax-progress ax-progress--xs" style={{ width: 48 }}><span className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${r.score}%`, background: scoreColor(r.score) }} /></span></span>
                      </div>
                    </td>
                    <td className="ax-table__td">
                      <span className="ax-cluster" style={{ gap: 6, flexWrap: 'nowrap', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>
                        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: srcColor[r.source] || C.cyan }}>{(SRC_PATH[r.source] || SRC_PATH.Website).map((d, i) => <path key={i} d={d} />)}</svg>
                        <span>{r.source}</span>
                      </span>
                    </td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--pill ax-badge--sm ${statusClass(r.status)}`}><span className="ax-badge__dot" /><span>{r.status}</span></span></td>
                    <td className="ax-table__td">
                      {r.assigned ? (
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                          <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${r.ownerC} 20%,transparent)`, color: r.ownerC, fontWeight: 600 }}><span style={{ fontSize: 10 }}>{r.ownerI}</span></span>
                          <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>{r.owner}</span>
                        </div>
                      ) : <span style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-sm)' }}>Unassigned</span>}
                    </td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>{r.added}</td>
                    <td className="ax-table__td" style={{ textAlign: 'end' }}>
                      <div className="ax-cluster" style={{ gap: 6, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                        <button type="button" className="ax-btn ax-btn--soft-success ax-btn--sm" onClick={() => convert(r.id)} disabled={r.status === 'Unqualified'} aria-label={'Convert ' + r.name + ' to deal'}>
                          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /><path d="M12 13l0 9" /><path d="M9 16l3 -3l3 3" /></svg>
                          <span className="ax-btn__label">Convert</span>
                        </button>
                        <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={(e) => toggleMenu(r.id, e)} aria-expanded={menu?.id === r.id} aria-haspopup="menu" aria-label="More actions"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M17 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* empty */}
          {!filtered.length && (
            <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6l0 13" /><path d="M12 6l0 13" /><path d="M21 6l0 13" /></svg></span>
              <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No leads found</h3>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>No leads match your search and filters.</p>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => { setQ(''); setFSource(''); setFStatus('All'); setPage(1); }}>Clear filters</button>
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

      {/* ROW ACTIONS MENU — fixed-positioned, anchored to the open trigger */}
      {menu !== null && (
        <>
          <button type="button" aria-hidden="true" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'transparent', border: 0, cursor: 'default' }} onClick={() => setMenu(null)} />
          <div className="ax-menu" role="menu" style={{ position: 'fixed', top: menu.y, insetInlineEnd: menu.x, zIndex: 60, minWidth: 170 }}>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>View lead</button>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>Assign to me</button>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg>Send email</button>
            <div className="ax-menu__divider" role="separator" />
            <button type="button" className="ax-menu__item ax-menu__item--danger" role="menuitem" onClick={() => menu && disqualify(menu.id)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18.364 5.636a9 9 0 1 0 0 12.728a9 9 0 0 0 0 -12.728z" /><path d="M5.7 5.7l12.6 12.6" /></svg>Disqualify</button>
          </div>
        </>
      )}

      {/* CONVERT TOAST */}
      {toast && (
        <div style={{ position: 'fixed', insetBlockEnd: 'var(--ax-space-6)', insetInlineEnd: 'var(--ax-space-6)', zIndex: 80 }}>
          <div className="ax-card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) var(--ax-space-4)', borderColor: 'color-mix(in oklab,var(--ax-success-500) 40%,var(--ax-border))' }}>
            <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-success-500) 18%,transparent)', color: 'var(--ax-success-500)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
            <div><b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{toast}</b><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>A new deal was created in the pipeline.</div></div>
          </div>
        </div>
      )}

      {/* NEW LEAD MODAL */}
      {addOpen && (
        <div onKeyDown={(e) => { if (e.key === 'Escape') setAddOpen(false); }}>
          <button type="button" aria-hidden="true" tabIndex={-1} className="ax-backdrop" onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.4)', border: 0 }} />
          <div className="ax-flex" role="dialog" aria-modal="true" aria-label="New lead" style={{ position: 'fixed', inset: 0, zIndex: 51, alignItems: 'center', justifyContent: 'center', padding: 'var(--ax-space-4)' }}>
            <form className="ax-card" onSubmit={(e) => { e.preventDefault(); setAddOpen(false); }} onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px,100%)', maxHeight: '90vh', overflow: 'auto' }}>
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">New lead</h2></div>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setAddOpen(false)} aria-label="Close"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field"><label className="ax-label" htmlFor="ld-name">Full name</label><input id="ld-name" type="text" className="ax-input" placeholder="Jordan Avery" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="ld-company">Company</label><input id="ld-company" type="text" className="ax-input" placeholder="Acme Inc." /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ld-email">Email</label><input id="ld-email" type="email" className="ax-input" placeholder="jordan@acme.com" /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="ld-source">Source</label><select id="ld-source" className="ax-select"><option>Website</option><option>Referral</option><option>Cold outreach</option><option>Event</option><option>Paid ads</option><option>Webinar</option></select></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ld-owner">Assign to</label><select id="ld-owner" className="ax-select"><option>Unassigned</option><option>Maya Lindqvist</option><option>Devon Okafor</option><option>Ava Sutton</option></select></div>
                </div>
              </div>
              <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)' }}>
                <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setAddOpen(false)}>Cancel</button>
                <button type="submit" className="ax-btn ax-btn--primary">Create lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Leads;
