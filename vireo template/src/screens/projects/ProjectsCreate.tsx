'use client';
/*
 * Vireo Next.js — Projects / Create (route "projects/create").
 *
 * Faithful re-expression of src/html/projects/create.html: a multi-step new-project
 * form — details (name/description/department/priority + colour picker), timeline
 * (start/due + live duration), milestones (add/remove rows) — alongside a rail
 * with a team picker, budget and visibility, plus a sticky action bar and a
 * success alert. The Alpine x-data (axProjectForm) is ported to React state;
 * classes + ARIA match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = {
  cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)',
  amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)', accent: 'var(--ax-accent)',
};

const PALETTE = [
  { name: 'Accent', v: C.accent }, { name: 'Cyan', v: C.cyan }, { name: 'Violet', v: C.violet },
  { name: 'Pink', v: C.pink }, { name: 'Amber', v: C.amber }, { name: 'Emerald', v: C.emerald },
];

const PEOPLE = [
  { id: 'lena', name: 'Lena Brandt', role: 'Principal Designer', i: 'LB', c: C.accent },
  { id: 'devon', name: 'Devon Okafor', role: 'Staff Engineer', i: 'DO', c: C.cyan },
  { id: 'priya', name: 'Priya Nair', role: 'Accessibility', i: 'PN', c: C.pink },
  { id: 'ava', name: 'Ava Sutton', role: 'Product Designer', i: 'AS', c: C.amber },
  { id: 'tomas', name: 'Tomás Herrera', role: 'Frontend Engineer', i: 'TH', c: C.violet },
  { id: 'marcus', name: 'Marcus Reid', role: 'Growth Lead', i: 'MR', c: C.emerald },
];

interface Milestone { id: number; name: string; date: string; }

export function ProjectsCreate() {
  const [saved, setSaved] = useState(false);
  const [savedKind, setSavedKind] = useState('');
  const [msid, setMsid] = useState(2);
  const [form, setForm] = useState({
    name: '', desc: '', category: 'design', priority: 'medium', color: C.accent,
    start: '', due: '', lead: 'lena', team: ['lena', 'devon'] as string[], budget: '', currency: 'usd', billable: false, visibility: 'team',
  });
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: 1, name: 'Kickoff & scoping', date: '' },
    { id: 2, name: 'Design freeze', date: '' },
  ]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleTeam = (id: string) => setForm((f) => ({ ...f, team: f.team.includes(id) ? f.team.filter((x) => x !== id) : [...f.team, id] }));

  const addMilestone = () => { const next = msid + 1; setMsid(next); setMilestones((m) => [...m, { id: next, name: '', date: '' }]); };
  const removeMilestone = (mi: number) => setMilestones((m) => m.filter((_, i) => i !== mi));
  const setMilestone = (mi: number, patch: Partial<Milestone>) => setMilestones((m) => m.map((x, i) => (i === mi ? { ...x, ...patch } : x)));

  const durationDays = () => {
    if (!form.start || !form.due) return 0;
    const d = (new Date(form.due).getTime() - new Date(form.start).getTime()) / 86400000;
    return d > 0 ? Math.round(d) : 0;
  };

  const save = (kind: string) => {
    setSavedKind(kind); setSaved(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => setSaved(false), 4000);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); save('create'); }}>
      <PageHead
        title="New Project"
        subtitle="Set the scope, assign a team, plan the budget & milestones, then kick off."
        actions={
          <Link className="ax-btn ax-btn--ghost" href="/projects/list">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
            <span className="ax-btn__label">Back to projects</span>
          </Link>
        }
      />

      {/* success alert */}
      {saved && (
        <div className="ax-alert ax-alert--success" role="status" style={{ marginBottom: 'var(--ax-space-6)' }}>
          <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
          <div className="ax-alert__content"><p className="ax-alert__title">{savedKind === 'draft' ? 'Saved as draft' : 'Project created'}</p><p className="ax-alert__message">{savedKind === 'draft' ? 'Your project draft is saved.' : 'Your project is live and the team has been notified.'}</p></div>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setSaved(false)} aria-label="Dismiss"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
        </div>
      )}

      {/* CONTENT */}
      <div className="ax-dash-grid" style={{ paddingBottom: 96 }}>
        {/* LEFT (8) */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* DETAILS */}
          <section className="ax-card" role="region" aria-label="Project details">
            <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 1</span><h2 className="ax-card__title">Project details</h2><p className="ax-card__subtitle">The essentials your team sees first.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="pr-name">Project name <span className="ax-field__required">*</span></label>
                <input id="pr-name" type="text" className="ax-input" placeholder="e.g. Aurora Redesign" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} />
              </div>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="pr-desc">Description</label>
                <textarea id="pr-desc" className="ax-textarea" rows={3} placeholder="What's the goal, the scope and the definition of done?" value={form.desc} onChange={(e) => set('desc', e.target.value)} maxLength={400} style={{ minHeight: 96 }} />
                <span className="ax-help"><span className="ax-num">{form.desc.length}</span> / 400 characters</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field" style={{ gridColumn: 'span 6', margin: 0 }}>
                  <label className="ax-label" htmlFor="pr-category">Department</label>
                  <select id="pr-category" className="ax-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                    <option value="design">Design</option>
                    <option value="engineering">Engineering</option>
                    <option value="product">Product</option>
                    <option value="marketing">Marketing</option>
                    <option value="platform">Platform</option>
                    <option value="analytics">Analytics</option>
                  </select>
                </div>
                <div className="ax-field" style={{ gridColumn: 'span 6', margin: 0 }}>
                  <label className="ax-label" htmlFor="pr-priority">Priority</label>
                  <select id="pr-priority" className="ax-select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              {/* accent colour picker */}
              <div>
                <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Project colour</div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  {PALETTE.map((c) => (
                    <button key={c.v} type="button" onClick={() => set('color', c.v)} aria-label={'Colour ' + c.name} aria-pressed={form.color === c.v} style={{ width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', border: '2px solid', display: 'grid', placeItems: 'center', background: c.v, borderColor: form.color === c.v ? 'var(--ax-text-strong)' : 'transparent' }}>
                      {form.color === c.v && <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* TIMELINE */}
          <section className="ax-card" role="region" aria-label="Timeline">
            <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 2</span><h2 className="ax-card__title">Timeline</h2><p className="ax-card__subtitle">When does work start and when is it due?</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field" style={{ gridColumn: 'span 6', margin: 0 }}>
                  <label className="ax-label" htmlFor="pr-start">Start date <span className="ax-field__required">*</span></label>
                  <input id="pr-start" type="date" className="ax-input ax-num" value={form.start} onChange={(e) => set('start', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} />
                </div>
                <div className="ax-field" style={{ gridColumn: 'span 6', margin: 0 }}>
                  <label className="ax-label" htmlFor="pr-due">Due date <span className="ax-field__required">*</span></label>
                  <input id="pr-due" type="date" className="ax-input ax-num" value={form.due} onChange={(e) => set('due', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} />
                </div>
              </div>
              {!!durationDays() && (
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-accent)' }}><path d="M12 8v4l3 3" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /></svg>
                  <span>Duration: <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{durationDays()}</b> days</span>
                </div>
              )}
            </div>
          </section>

          {/* MILESTONES */}
          <section className="ax-card" role="region" aria-label="Milestones">
            <div className="ax-card__header">
              <div className="ax-card__titles"><span className="ax-card__eyebrow">Step 3</span><h2 className="ax-card__title">Milestones</h2><p className="ax-card__subtitle">Break the project into checkpoints.</p></div>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={addMilestone}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg><span className="ax-btn__label">Add milestone</span></button>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              {milestones.map((m, mi) => (
                <div key={m.id} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'center' }}>
                  <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', fontWeight: 700, flex: 'none' }}>{mi + 1}</span>
                  <input type="text" className="ax-input" placeholder="Milestone name (e.g. Design freeze)" value={m.name} onChange={(e) => setMilestone(mi, { name: e.target.value })} style={{ flex: '1 1 auto' }} aria-label={'Milestone ' + (mi + 1) + ' name'} />
                  <input type="date" className="ax-input ax-num" value={m.date} onChange={(e) => setMilestone(mi, { date: e.target.value })} style={{ fontFamily: 'var(--ax-font-mono)', width: 160, flex: 'none' }} aria-label={'Milestone ' + (mi + 1) + ' date'} />
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => removeMilestone(mi)} aria-label={'Remove milestone ' + (mi + 1)}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>
                </div>
              ))}
              {!milestones.length && <div style={{ textAlign: 'center', padding: 'var(--ax-space-6) 0', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>No milestones yet. Add one to map out the plan.</div>}
            </div>
          </section>
        </div>

        {/* RIGHT (4) */}
        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* TEAM PICKER */}
          <section className="ax-card" role="region" aria-label="Team">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Team</h2></div><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-num"><span>{form.team.length}</span> selected</span></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="pr-lead">Project lead <span className="ax-field__required">*</span></label>
                <select id="pr-lead" className="ax-select" value={form.lead} onChange={(e) => set('lead', e.target.value)}>
                  {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Members</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                  {PEOPLE.map((p) => (
                    <label key={p.id} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', cursor: 'pointer', padding: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', background: form.team.includes(p.id) ? 'var(--ax-accent-wash)' : undefined }}>
                      <input type="checkbox" className="ax-checkbox" checked={form.team.includes(p.id)} onChange={() => toggleTeam(p.id)} />
                      <span className="ax-avatar ax-avatar--xs" style={{ background: `color-mix(in oklab,${p.c} 22%,transparent)`, color: p.c, fontWeight: 600, flex: 'none' }}>{p.i}</span>
                      <span style={{ flex: '1 1 auto', minWidth: 0 }}><span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{p.name}</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{p.role}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* BUDGET */}
          <section className="ax-card" role="region" aria-label="Budget">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Budget</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="pr-budget">Total budget</label>
                <div className="ax-input-group">
                  <span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)' }}>$</span>
                  <input id="pr-budget" type="text" className="ax-input ax-num" inputMode="numeric" placeholder="0" value={form.budget} onChange={(e) => set('budget', e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} />
                </div>
              </div>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="pr-currency">Currency</label>
                <select id="pr-currency" className="ax-select" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  <option value="usd">USD — US Dollar</option>
                  <option value="eur">EUR — Euro</option>
                  <option value="gbp">GBP — British Pound</option>
                </select>
              </div>
              <label className="ax-check" style={{ gap: 'var(--ax-space-3)' }}>
                <input type="checkbox" className="ax-switch" checked={form.billable} onChange={(e) => set('billable', e.target.checked)} />
                <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>Billable project</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Track time against client invoices.</span></span>
              </label>
            </div>
          </section>

          {/* VISIBILITY */}
          <section className="ax-card" role="region" aria-label="Visibility">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Visibility</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--ax-space-3)', cursor: 'pointer', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3) var(--ax-space-4)', border: '1.5px solid', borderColor: form.visibility === 'team' ? 'var(--ax-accent)' : 'var(--ax-border)', background: form.visibility === 'team' ? 'var(--ax-accent-wash)' : 'var(--ax-surface)' }}>
                <input type="radio" name="pr-vis" className="ax-radio" value="team" checked={form.visibility === 'team'} onChange={() => set('visibility', 'team')} style={{ marginTop: 2 }} />
                <span><span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Team only</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Visible to members you add.</span></span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--ax-space-3)', cursor: 'pointer', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3) var(--ax-space-4)', border: '1.5px solid', borderColor: form.visibility === 'org' ? 'var(--ax-accent)' : 'var(--ax-border)', background: form.visibility === 'org' ? 'var(--ax-accent-wash)' : 'var(--ax-surface)' }}>
                <input type="radio" name="pr-vis" className="ax-radio" value="org" checked={form.visibility === 'org'} onChange={() => set('visibility', 'org')} style={{ marginTop: 2 }} />
                <span><span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Whole organization</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Anyone in the workspace can view.</span></span>
              </label>
            </div>
          </section>
        </aside>
      </div>

      {/* STICKY ACTION BAR */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 5, margin: '0 calc(-1 * var(--ax-space-6))', padding: 'var(--ax-space-4) var(--ax-space-6)', background: 'var(--ax-surface)', backdropFilter: 'blur(18px) saturate(1.1)', borderTop: '1px solid var(--ax-border)', boxShadow: 'var(--ax-shadow-sm)' }}>
        <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
          <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-accent)' }}><path d="M9 12l2 2l4 -4" /><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" /></svg>
            <span><b className="ax-num">{form.team.length}</b> members · <b className="ax-num">{milestones.length}</b> milestones</span>
          </span>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
            <Link className="ax-btn ax-btn--ghost" href="/projects/list">Cancel</Link>
            <button type="button" className="ax-btn ax-btn--secondary" onClick={() => save('draft')}>Save draft</button>
            <button type="submit" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Create project</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default ProjectsCreate;
