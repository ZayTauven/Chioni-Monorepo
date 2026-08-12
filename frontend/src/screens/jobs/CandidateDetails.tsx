'use client';
/*
 * Vireo Next.js — Jobs / Candidate Details (route "jobs/candidate-details").
 *
 * Faithful re-expression of src/html/jobs/candidate-details.html: a profile
 * rail (avatar, match score, contact rows, skills, actions) beside a hiring
 * stage stepper, tabbed Overview / Experience / Skills / Resume panels, and an
 * internal-notes thread. The Alpine local state (tab/shortlisted/contacted/
 * stage + notes x-data) is ported to React; classes + ARIA match 1:1.
 */
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const ICON = (paths: string[], extra?: Record<string, unknown>): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{paths.map((d, i) => <path key={i} d={d} />)}</svg>
);
const COMPANY = ['M3 21l18 0', 'M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16'];
const STAGES = ['Applied', 'Screen', 'Interview', 'Offer', 'Hired'];

type Tab = 'overview' | 'experience' | 'skills' | 'resume';
interface Note { who: string; when: string; body: string }
const INITIAL_NOTES: Note[] = [
  { who: 'Priya Nair', when: 'Jun 26, 2026 · 2:10 PM', body: 'Strong portfolio — the token pipeline at Helios is exactly the kind of work we need. Moving to interview.' },
  { who: 'Devon Okafor', when: 'Jun 25, 2026 · 11:42 AM', body: 'Screened — clear communicator, async-comfortable. Salary expectation slightly above band, flagged for discussion.' },
];

function MatchBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{label}</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{value}%</b></div>
      <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${value}%`, background: color }} /></div></div>
    </div>
  );
}
function SkillBar({ label, level, value, color }: { label: string; level: string; value: number; color: string }) {
  return (
    <div>
      <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{label}</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{level}</span></div>
      <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${value}%`, background: color }} /></div></div>
    </div>
  );
}

export function CandidateDetails() {
  const [tab, setTab] = useState<Tab>('overview');
  const [shortlisted, setShortlisted] = useState(false);
  const [contacted, setContacted] = useState(false);
  const stage = 'Interview';
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
  const [draft, setDraft] = useState('');

  const flash = () => { setContacted(true); window.setTimeout(() => setContacted(false), 2200); };
  const addNote = () => { if (!draft.trim()) return; setNotes((n) => [{ who: 'You', when: 'Just now', body: draft.trim() }, ...n]); setDraft(''); };
  const stageIdx = STAGES.indexOf(stage);

  return (
    <>
      <style>{`@media (max-width: 640px){ .ax-cd-stats { grid-template-columns: repeat(3, minmax(0,1fr)) !important; } .ax-cd-skills { grid-template-columns: 1fr !important; } .ax-cd-stages { grid-template-columns: repeat(5, 1fr) !important; } }`}</style>
      <PageHead
        title="Aria Voss"
        subtitle={(<>Design Systems Lead · Berlin, DE · <span className="ax-num">8</span> yrs experience · <span className="ax-num">91%</span> match for Senior Product Designer.</>) as unknown as string}
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/jobs/search-candidate">{ICON(['M5 12l14 0', 'M5 12l6 6', 'M5 12l6 -6'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Back to candidates</span></Link>
            <button type="button" className="ax-btn ax-btn--secondary" onClick={flash}>{ICON(['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z', 'M3 7l9 6l9 -6'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">{contacted ? 'Message sent' : 'Message'}</span></button>
            <button type="button" className={`ax-btn ax-btn--primary${shortlisted ? ' ax-btn--soft-success' : ''}`} onClick={() => setShortlisted(!shortlisted)}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill={shortlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
              <span className="ax-btn__label">{shortlisted ? 'Shortlisted' : 'Shortlist'}</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* LEFT PROFILE CARD (4) */}
        <aside className="ax-card ax-col--4" role="region" aria-label="Candidate profile" style={{ alignSelf: 'start' }}>
          <div className="ax-card__body" style={{ textAlign: 'center' }}>
            <span className="ax-avatar ax-avatar--2xl ax-avatar--ringed" style={{ marginInline: 'auto', boxShadow: '0 0 0 4px var(--ax-surface-raised),0 0 0 6px var(--ax-accent)', background: 'color-mix(in oklab,var(--ax-accent) 16%,var(--ax-surface-solid))', color: 'var(--ax-accent)' }}>
              <span className="ax-avatar__initials" style={{ fontSize: 'var(--ax-text-2xl)' }}>AV</span>
              <span className="ax-avatar__status ax-avatar__status--online" aria-hidden="true" />
            </span>
            <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)', marginTop: 'var(--ax-space-4)', lineHeight: 1.2 }}>Aria Voss</h2>
            <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginTop: 'var(--ax-space-1)' }}>Design Systems Lead</p>
            <div className="ax-cluster" style={{ justifyContent: 'center', gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-3)' }}>
              <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Available · 2 weeks</span>
              {shortlisted && <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill"><span className="ax-badge__dot" />Shortlisted</span>}
            </div>
          </div>

          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)', background: 'var(--ax-surface-subtle)' }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                <span style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text)' }}>Match score</span>
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-accent)', fontSize: 'var(--ax-text-md)' }}>91%</b>
              </div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '91%', background: 'var(--ax-accent)' }} /></div></div>
              <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 'var(--ax-space-2)' }}>Against <span style={{ color: 'var(--ax-text)' }}>Senior Product Designer</span></div>
            </div>
          </div>

          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
            <a className="ax-list__row ax-list--linked" href="mailto:aria.voss@hey.com" style={{ border: 0, padding: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none' }}>
              <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}>{ICON(['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z', 'M3 7l9 6l9 -6'], { width: 18, height: 18 })}</span>
              <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>aria.voss@hey.com</span></span>
            </a>
            <a className="ax-list__row ax-list--linked" href="tel:+4915123456789" style={{ border: 0, padding: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none' }}>
              <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}>{ICON(['M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2'], { width: 18, height: 18 })}</span>
              <span className="ax-list__content"><span className="ax-list__title ax-num" style={{ color: 'var(--ax-text)', fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-medium)' }}>+49 151 2345 6789</span></span>
            </a>
            <div className="ax-list__row" style={{ border: 0, padding: 'var(--ax-space-2)' }}>
              <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}>{ICON(['M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0'], { width: 18, height: 18 })}</span>
              <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text)' }}>Berlin, Germany</span></span>
            </div>
            <a className="ax-list__row ax-list--linked" href="#" style={{ border: 0, padding: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none' }}>
              <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}>{ICON(['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M3.6 9h16.8', 'M3.6 15h16.8', 'M11.5 3a17 17 0 0 0 0 18', 'M12.5 3a17 17 0 0 1 0 18'], { width: 18, height: 18 })}</span>
              <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text)' }}>aria.design</span></span>
            </a>
          </div>

          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Top skills</div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
              <span className="ax-badge ax-badge--soft ax-badge--accent" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Design Systems</span>
              <span className="ax-badge ax-badge--soft ax-badge--accent" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Figma</span>
              <span className="ax-badge ax-badge--soft ax-badge--accent" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Accessibility</span>
              <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Design Tokens</span>
              <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ borderRadius: 'var(--ax-radius-xs)' }}>SCSS</span>
            </div>
          </div>

          <div className="ax-card__footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-2)' }}>
            <a className="ax-btn ax-btn--secondary ax-btn--block" href="#" download>{ICON(['M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2', 'M7 11l5 5l5 -5', 'M12 4l0 12'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Resume</span></a>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--block" onClick={flash}>{ICON(['M8 9h8', 'M8 13h6', 'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Message</span></button>
          </div>
        </aside>

        {/* RIGHT CONTENT (8) */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* HIRING STAGE STEPPER */}
          <section className="ax-card" role="region" aria-label="Hiring stage">
            <div className="ax-card__body">
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-4)', flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
                <div>
                  <div className="ax-card__eyebrow">Pipeline</div>
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Senior Product Designer · <span>{stage}</span></div>
                </div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm">{ICON(['M9 6l6 6l-6 6'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Advance stage</span></button>
              </div>
              <ol className="ax-cd-stages" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 'var(--ax-space-2)', listStyle: 'none', padding: 0 }}>
                {STAGES.map((st, i) => (
                  <li key={st} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ height: 4, borderRadius: 'var(--ax-radius-pill)', background: i <= stageIdx ? 'var(--ax-accent)' : 'var(--ax-border)' }} />
                    <span style={{ fontSize: 'var(--ax-text-xs)', fontWeight: 'var(--ax-weight-medium)', color: i <= stageIdx ? 'var(--ax-text-strong)' : 'var(--ax-text-subtle)' }}>{st}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* TABS */}
          <section className="ax-card" role="region" aria-label="Candidate detail tabs">
            <div className="ax-card__body" style={{ paddingBottom: 0 }}>
              <div className="ax-tabs">
                <div className="ax-tabs__list" role="tablist" aria-label="Candidate sections">
                  {(['overview', 'experience', 'skills', 'resume'] as Tab[]).map((t) => (
                    <button key={t} type="button" className={`ax-tabs__tab${tab === t ? ' is-active' : ''}`} role="tab" id={`cd-tab-${t}`} aria-selected={tab === t} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="ax-card__body ax-flex" role="tabpanel" aria-labelledby="cd-tab-overview" style={{ paddingTop: 'var(--ax-space-5)', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
                <div>
                  <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-2)' }}>Summary</div>
                  <p style={{ color: 'var(--ax-text)', lineHeight: 1.7, fontSize: 'var(--ax-text-sm)' }}>Design systems lead with 8 years building accessible, token-driven UI for developer-facing products. Shipped the component library powering 5 products at Helios, drove a full WCAG 2.2 AA audit, and mentors a team of four. Looking for a senior IC role with deep design-systems ownership.</p>
                </div>
                <div className="ax-cd-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 'var(--ax-space-4)' }}>
                  <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)', textAlign: 'center' }}><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 700, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-xl)' }}>8</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Years experience</div></div>
                  <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)', textAlign: 'center' }}><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 700, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-xl)' }}>4</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Companies</div></div>
                  <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)', textAlign: 'center' }}><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 700, color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-xl)' }}>91%</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Role match</div></div>
                </div>
                <div>
                  <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-4)' }}>Match breakdown</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                    <MatchBar label="Skills overlap" value={95} color="var(--ax-accent)" />
                    <MatchBar label="Experience level" value={90} color="var(--ax-viz-cyan)" />
                    <MatchBar label="Location / time zone" value={100} color="var(--ax-viz-violet)" />
                    <MatchBar label="Salary expectation" value={78} color="var(--ax-viz-amber)" />
                  </div>
                </div>
              </div>
            )}

            {/* EXPERIENCE */}
            {tab === 'experience' && (
              <div className="ax-card__body" role="tabpanel" aria-labelledby="cd-tab-experience" style={{ paddingTop: 'var(--ax-space-5)' }}>
                <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-4)' }}>Work history</div>
                <ul className="ax-timeline">
                  <li className="ax-timeline__item ax-timeline__item--success">
                    <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{COMPANY.map((d, i) => <path key={i} d={d} />)}</svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Design Systems Lead</b> · Helios Cloud</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>2022 — Present · 4 yrs</span><p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6, marginTop: 6 }}>Built the cross-product component library and token pipeline. Led the WCAG 2.2 AA audit; manages a team of four designers.</p></div>
                  </li>
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{COMPANY.map((d, i) => <path key={i} d={d} />)}</svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Senior Product Designer</b> · Vela Systems</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>2019 — 2022 · 3 yrs</span><p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6, marginTop: 6 }}>Owned the analytics and billing surfaces end-to-end; introduced the first shared Figma library.</p></div>
                  </li>
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{COMPANY.map((d, i) => <path key={i} d={d} />)}</svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Product Designer</b> · Lumen Brands</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>2018 — 2019 · 1 yr</span><p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6, marginTop: 6 }}>Redesigned the marketing site and onboarding flow, lifting activation by 18%.</p></div>
                  </li>
                </ul>
                <hr className="ax-divider" style={{ marginBlock: 'var(--ax-space-5)' }} />
                <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-4)' }}>Education</div>
                <ul className="ax-timeline">
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" /><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>BA, Communication Design</b> · UdK Berlin</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>2014 — 2018</span></div>
                  </li>
                </ul>
              </div>
            )}

            {/* SKILLS */}
            {tab === 'skills' && (
              <div className="ax-card__body" role="tabpanel" aria-labelledby="cd-tab-skills" style={{ paddingTop: 'var(--ax-space-5)' }}>
                <div className="ax-cd-skills" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-6) var(--ax-space-8)' }}>
                  <SkillBar label="Design Systems" level="Expert" value={96} color="var(--ax-accent)" />
                  <SkillBar label="Figma" level="Expert" value={94} color="var(--ax-viz-cyan)" />
                  <SkillBar label="Accessibility (WCAG)" level="Advanced" value={88} color="var(--ax-viz-violet)" />
                  <SkillBar label="Design Tokens" level="Advanced" value={85} color="var(--ax-viz-amber)" />
                  <SkillBar label="UX Research" level="Proficient" value={72} color="var(--ax-viz-pink)" />
                  <SkillBar label="Front-end (SCSS/JS)" level="Proficient" value={68} color="var(--ax-viz-emerald)" />
                </div>
                <hr className="ax-divider" style={{ marginBlock: 'var(--ax-space-5)' }} />
                <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-3)' }}>Certifications</div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                  {['IAAP CPACC', 'NN/g UX Master'].map((c) => (
                    <span key={c} className="ax-cluster" style={{ gap: 6, border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-pill)', padding: '6px var(--ax-space-3)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{ICON(['M12 15a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M13 17.5v4.5l2 -1.5l2 1.5v-4.5', 'M10 19h-5a2 2 0 0 1 -2 -2v-10c0 -1.1 .9 -2 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -1 1.73', 'M6 9l12 0'], { width: 15, height: 15, style: { color: 'var(--ax-accent)' } })}{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* RESUME */}
            {tab === 'resume' && (
              <div className="ax-card__body" role="tabpanel" aria-labelledby="cd-tab-resume" style={{ paddingTop: 'var(--ax-space-5)' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)' }}>
                  <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-danger-500) 16%,transparent)', color: 'var(--ax-danger-500)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /><path d="M11 12.5a1.5 1.5 0 0 0 -3 0v3a1.5 1.5 0 0 0 3 0" /><path d="M13 11l1.5 6l1.5 -6" /></svg></span>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>aria-voss-resume.pdf</div>
                    <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>PDF · 284 KB · uploaded Jun 25, 2026</div>
                  </div>
                  <a className="ax-btn ax-btn--secondary ax-btn--sm" href="#" download>{ICON(['M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2', 'M7 11l5 5l5 -5', 'M12 4l0 12'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Download</span></a>
                </div>
                <div style={{ marginTop: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', padding: 'var(--ax-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                  <div style={{ height: 14, width: '42%', borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-surface-raised)' }} />
                  <div style={{ height: 9, width: '80%', borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-border)' }} />
                  <div style={{ height: 9, width: '74%', borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-border)' }} />
                  <div style={{ height: 9, width: '64%', borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-border)' }} />
                  <div style={{ height: 9, width: 0 }} />
                  <div style={{ height: 11, width: '34%', borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-surface-raised)' }} />
                  <div style={{ height: 9, width: '78%', borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-border)' }} />
                  <div style={{ height: 9, width: '70%', borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-border)' }} />
                  <div className="ax-cluster" style={{ justifyContent: 'center', marginTop: 'var(--ax-space-2)' }}>
                    <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Inline preview — download the PDF for the full resume</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* INTERNAL NOTES */}
          <section className="ax-card" role="region" aria-label="Internal notes">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Internal notes</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <form onSubmit={(e) => { e.preventDefault(); addNote(); }} style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'flex-start', marginBottom: 'var(--ax-space-5)' }}>
                <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-accent) 16%,transparent)', color: 'var(--ax-accent)' }}><span className="ax-avatar__initials">YO</span></span>
                <div style={{ flex: '1 1 auto' }}>
                  <textarea className="ax-textarea" rows={2} placeholder="Add a note for the hiring team…" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 60 }} />
                  <div className="ax-cluster" style={{ justifyContent: 'flex-end', marginTop: 'var(--ax-space-2)' }}>
                    <button type="submit" className="ax-btn ax-btn--primary ax-btn--sm" disabled={!draft.trim()}>Add note</button>
                  </div>
                </div>
              </form>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', listStyle: 'none', padding: 0 }}>
                {notes.map((n, i) => (
                  <li key={i} style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)' }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{n.who}</span>
                      <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{n.when}</span>
                    </div>
                    <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>{n.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export default CandidateDetails;
