'use client';
/*
 * Vireo Next.js — Jobs / Job Details (route "jobs/job-details").
 *
 * Faithful re-expression of src/html/jobs/job-details.html: a fact-strip
 * header, description/requirements/skills/benefits body, similar roles, a
 * sticky apply rail + company + at-a-glance cards, an applied banner and an
 * Apply modal. The Alpine local state (saved/applied/showApply/resume) is
 * ported to React; classes + ARIA match the reference 1:1.
 */
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const ICON = (paths: string[], extra?: Record<string, unknown>): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{paths.map((d, i) => <path key={i} d={d} />)}</svg>
);
const COMPANY = ['M3 21l18 0', 'M9 8l1 0', 'M9 12l1 0', 'M9 16l1 0', 'M14 8l1 0', 'M14 12l1 0', 'M14 16l1 0', 'M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16'];
const COMPANY_SM = ['M3 21l18 0', 'M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16'];
const SEND = ['M10 14l11 -11', 'M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5'];

function SimilarRow({ color, title, sub, range }: { color: string; title: string; sub: string; range: string }) {
  return (
    <Link href="/jobs/job-details" className="ax-list__row" style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3) var(--ax-space-4)', textDecoration: 'none' }}>
      <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${color} 18%,transparent)`, color }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{COMPANY_SM.map((d, i) => <path key={i} d={d} />)}</svg></span>
      <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text-strong)' }}>{title}</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{sub}</span></span>
      <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>{range}</span>
    </Link>
  );
}

export function JobDetails() {
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [resume, setResume] = useState(false);

  return (
    <>
      <style>{`@media (max-width: 640px){ .ax-jd-facts { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } .ax-jd-perks { grid-template-columns: 1fr !important; } }`}</style>
      <PageHead
        title="Senior Product Designer"
        subtitle={(<>Northwind Labs · Design · Posted <span className="ax-num">Jun 24, 2026</span> · <span className="ax-num">38</span> applicants.</>) as unknown as string}
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/jobs/list">{ICON(['M5 12l14 0', 'M5 12l6 6', 'M5 12l6 -6'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">All jobs</span></Link>
            <button type="button" className={`ax-btn ax-btn--secondary${saved ? ' ax-btn--soft-success' : ''}`} onClick={() => setSaved(!saved)}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4" /></svg>
              <span className="ax-btn__label">{saved ? 'Saved' : 'Save'}</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" disabled={applied} onClick={() => setShowApply(true)}>{ICON(SEND, { className: 'ax-btn__icon' })}<span className="ax-btn__label">{applied ? 'Applied' : 'Apply now'}</span></button>
          </>
        }
      />

      {/* applied banner */}
      {applied && (
        <div className="ax-alert ax-alert--success" role="status" style={{ marginBottom: 'var(--ax-space-6)' }}>
          <span className="ax-alert__icon">{ICON(['M5 12l5 5l10 -10'])}</span>
          <div className="ax-alert__content"><p className="ax-alert__title">Application submitted</p><p className="ax-alert__message">Northwind Labs has received your application — you&apos;ll hear back within 5 business days.</p></div>
        </div>
      )}

      <div className="ax-dash-grid">
        {/* MAIN (8) */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* HEADER CARD */}
          <section className="ax-card" role="region" aria-label="Job summary">
            <div className="ax-card__body">
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)', flex: 'none' }}>
                  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 26, height: 26 }}>{COMPANY.map((d, i) => <path key={i} d={d} />)}</svg>
                </span>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.2 }}>Senior Product Designer</h2>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-2)' }}>
                    <span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text)' }}>Northwind Labs</span>
                    <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Actively hiring</span>
                  </div>
                </div>
              </div>
              {/* fact strip */}
              <div className="ax-jd-facts" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 'var(--ax-space-4)', marginTop: 'var(--ax-space-5)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>{ICON(['M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0'], { width: 15, height: 15 })}Location</span>
                  <b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Remote (EU)</b>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>{ICON(['M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9', 'M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2'], { width: 15, height: 15 })}Type</span>
                  <b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Full-time</b>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>{ICON(['M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2', 'M12 3v3m0 12v3'], { width: 15, height: 15 })}Salary</span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>$95K – $120K</b>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>{ICON(['M12 8v4l3 3', 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0'], { width: 15, height: 15 })}Experience</span>
                  <b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Senior · 6+ yrs</b>
                </div>
              </div>
            </div>
          </section>

          {/* DESCRIPTION + REQUIREMENTS */}
          <section className="ax-card" role="region" aria-label="Job description">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-3)' }}>About the role</h3>
                <p style={{ color: 'var(--ax-text)', lineHeight: 1.75, fontSize: 'var(--ax-text-sm)' }}>We&apos;re looking for a Senior Product Designer to shape the next generation of Northwind&apos;s design platform. You&apos;ll own end-to-end product flows — from early discovery and prototyping to polished, accessible production UI — partnering daily with PMs and engineers across the Surface team. This is a high-ownership role where your design decisions ship to <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>40,000+</span> teams.</p>
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-3)' }}>What you&apos;ll do</h3>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', listStyle: 'none', padding: 0 }}>
                  {[
                    'Lead the design of core workspace surfaces — navigation, dashboards, and the token-driven theming system.',
                    'Run discovery — interviews, journey mapping, and concept testing — and turn insight into shippable bets.',
                    'Contribute to and steward the design system, ensuring WCAG 2.2 AA across light and dark themes.',
                    'Mentor two mid-level designers and raise the craft bar through critique and pairing.',
                  ].map((t, i) => (
                    <li key={i} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', marginTop: 2, color: 'var(--ax-accent)' }}><path d="M5 12l5 5l10 -10" /></svg><span style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>{t}</span></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-3)' }}>Requirements</h3>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', listStyle: 'none', padding: 0 }}>
                  <li className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}><span style={{ flex: 'none', marginTop: 7, width: 6, height: 6, borderRadius: '50%', background: 'var(--ax-text-subtle)' }} /><span style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}><b style={{ color: 'var(--ax-text-strong)' }}>6+ years</b> designing complex SaaS or developer products, with a portfolio that shows shipped work.</span></li>
                  <li className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}><span style={{ flex: 'none', marginTop: 7, width: 6, height: 6, borderRadius: '50%', background: 'var(--ax-text-subtle)' }} /><span style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>Fluency in <b style={{ color: 'var(--ax-text-strong)' }}>Figma</b>, component-driven design, and design-token systems.</span></li>
                  <li className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}><span style={{ flex: 'none', marginTop: 7, width: 6, height: 6, borderRadius: '50%', background: 'var(--ax-text-subtle)' }} /><span style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>A real accessibility practice — you can reason about contrast, focus order, and semantics.</span></li>
                  <li className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}><span style={{ flex: 'none', marginTop: 7, width: 6, height: 6, borderRadius: '50%', background: 'var(--ax-text-subtle)' }} /><span style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>Comfortable working async across European time zones with strong written communication.</span></li>
                </ul>
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-3)' }}>Skills</h3>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                  {['Design Systems', 'Figma', 'Accessibility', 'Prototyping', 'UX Research', 'Design Tokens'].map((s) => <span key={s} className="ax-badge ax-badge--soft ax-badge--accent" style={{ borderRadius: 'var(--ax-radius-xs)' }}>{s}</span>)}
                </div>
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-3)' }}>Benefits &amp; perks</h3>
                <div className="ax-jd-perks" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
                  <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>{ICON(['M12 3l2.582 6.953l7.418 .382l-5.755 4.704l1.91 7.961l-6.155 -4.318l-6.155 4.318l1.91 -7.961l-5.755 -4.704l7.418 -.382z'], { width: 18, height: 18, style: { color: 'var(--ax-viz-emerald)', flex: 'none' } })}<span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Fully remote, async-first</span></span>
                  <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>{ICON(['M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2', 'M12 3v3m0 12v3'], { width: 18, height: 18, style: { color: 'var(--ax-viz-cyan)', flex: 'none' } })}<span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Equity + annual bonus</span></span>
                  <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>{ICON(['M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12', 'M16 3v4', 'M8 3v4', 'M4 11h16'], { width: 18, height: 18, style: { color: 'var(--ax-viz-violet)', flex: 'none' } })}<span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>30 days paid leave</span></span>
                  <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>{ICON(['M22 9l-10 -4l-10 4l10 4l10 -4v6', 'M6 10.6v5.4a6 3 0 0 0 12 0v-5.4'], { width: 18, height: 18, style: { color: 'var(--ax-viz-amber)', flex: 'none' } })}<span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>$2K yearly learning budget</span></span>
                </div>
              </div>
            </div>
          </section>

          {/* SIMILAR JOBS */}
          <section className="ax-card" role="region" aria-label="Similar jobs">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Similar roles</h2></div>
              <Link className="ax-btn ax-btn--link" href="/jobs/list">View all</Link>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <SimilarRow color="var(--ax-viz-violet)" title="UX Research Lead" sub="Northwind Labs · London, UK" range="$105K – $135K" />
              <SimilarRow color="var(--ax-viz-pink)" title="Design Systems Engineer" sub="Helios Cloud · Remote (EU)" range="$120K – $150K" />
              <SimilarRow color="var(--ax-viz-amber)" title="Senior Product Manager" sub="Vela Systems · Berlin, DE" range="$110K – $140K" />
            </div>
          </section>
        </div>

        {/* RAIL (4) */}
        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* STICKY APPLY PANEL */}
          <section className="ax-card ax-card--accent-edge" role="region" aria-label="Apply" style={{ alignSelf: 'start' }}>
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.1 }}>$95K – $120K</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Base salary · per year</div>
              </div>
              <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />
              <div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Applicants</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>38 / 60</b></div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '63%', background: 'var(--ax-accent)' }} /></div></div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 6 }}>Position closes when 60 applications are reached.</div>
              </div>
              <button type="button" className="ax-btn ax-btn--primary ax-btn--block ax-btn--lg" disabled={applied} onClick={() => setShowApply(true)}>{ICON(SEND, { className: 'ax-btn__icon' })}<span className="ax-btn__label">{applied ? 'Application sent' : 'Apply for this job'}</span></button>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--block" onClick={() => setSaved(!saved)}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4" /></svg>
                <span className="ax-btn__label">{saved ? 'Saved to your list' : 'Save for later'}</span>
              </button>
              <div className="ax-cluster" style={{ justifyContent: 'center', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                {ICON(['M5 12a7 7 0 0 1 14 0a7 7 0 0 1 -14 0', 'M12 9v3l1.5 1.5'], { width: 14, height: 14 })}<span>Typical reply within 5 days</span>
              </div>
            </div>
          </section>

          {/* COMPANY CARD */}
          <section className="ax-card" role="region" aria-label="About the company">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">About Northwind Labs</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
                <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{COMPANY_SM.map((d, i) => <path key={i} d={d} />)}</svg></span>
                <div>
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Northwind Labs</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Developer tools · Series B</div>
                </div>
              </div>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>Northwind builds the workspace platform trusted by modern product teams. Remote-first, 140 people across 18 countries.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
                <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3)', textAlign: 'center' }}>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>140</div>
                  <div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Employees</div>
                </div>
                <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3)', textAlign: 'center' }}>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>12</div>
                  <div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Open roles</div>
                </div>
              </div>
              <Link href="/jobs/list" className="ax-btn ax-btn--ghost ax-btn--block">{ICON(['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M3.6 9h16.8', 'M3.6 15h16.8', 'M11.5 3a17 17 0 0 0 0 18', 'M12.5 3a17 17 0 0 1 0 18'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">View company profile</span></Link>
            </div>
          </section>

          {/* KEY DETAILS */}
          <section className="ax-card" role="region" aria-label="At a glance">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">At a glance</h2></div></div>
            <ul className="ax-list ax-list--compact" style={{ padding: '0 var(--ax-space-5) var(--ax-space-4)' }}>
              <li className="ax-list__row"><span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text-muted)', fontWeight: 400 }}>Job ID</span></span><span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>JOB-120</span></li>
              <li className="ax-list__row"><span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text-muted)', fontWeight: 400 }}>Posted</span></span><span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>Jun 24, 2026</span></li>
              <li className="ax-list__row"><span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text-muted)', fontWeight: 400 }}>Closes</span></span><span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>Jul 22, 2026</span></li>
              <li className="ax-list__row"><span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text-muted)', fontWeight: 400 }}>Visa sponsorship</span></span><span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--success" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Available</span></span></li>
            </ul>
          </section>
        </aside>
      </div>

      {/* APPLY MODAL */}
      {showApply && (
        <div className="ax-backdrop ax-grid" onClick={() => setShowApply(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, placeItems: 'center', padding: 'var(--ax-space-4)', background: 'color-mix(in oklab,var(--ax-canvas) 60%,transparent)', backdropFilter: 'blur(6px)' }} onKeyDown={(e) => { if (e.key === 'Escape') setShowApply(false); }}>
          <div className="ax-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="apply-title" style={{ width: '100%', maxWidth: 520, margin: 0, maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--ax-shadow-lg)' }}>
            <div className="ax-card__header">
              <div className="ax-card__titles"><span className="ax-card__eyebrow">Northwind Labs</span><h2 className="ax-card__title" id="apply-title">Apply — Senior Product Designer</h2></div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setShowApply(false)} aria-label="Close">{ICON(['M18 6l-12 12', 'M6 6l12 12'], { className: 'ax-btn__icon' })}</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setApplied(true); setShowApply(false); }} className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field" style={{ margin: 0 }}><label className="ax-label" htmlFor="a-first">First name <span className="ax-field__required">*</span></label><input id="a-first" type="text" className="ax-input" placeholder="Aria" required /></div>
                <div className="ax-field" style={{ margin: 0 }}><label className="ax-label" htmlFor="a-last">Last name <span className="ax-field__required">*</span></label><input id="a-last" type="text" className="ax-input" placeholder="Voss" required /></div>
              </div>
              <div className="ax-field" style={{ margin: 0 }}><label className="ax-label" htmlFor="a-email">Email <span className="ax-field__required">*</span></label><input id="a-email" type="email" className="ax-input" placeholder="aria@example.com" required /></div>
              <div className="ax-field" style={{ margin: 0 }}><label className="ax-label" htmlFor="a-link">Portfolio / LinkedIn</label><input id="a-link" type="url" className="ax-input" placeholder="https://" /></div>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label">Resume <span className="ax-field__required">*</span></label>
                <div className="ax-dropzone">
                  <label className="ax-dropzone__area" htmlFor="a-resume" style={{ cursor: 'pointer' }}>
                    {ICON(['M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1', 'M9 15l3 -3l3 3', 'M12 12l0 9'])}
                    {!resume && <div><b style={{ color: 'var(--ax-text)' }}>Upload your resume</b> — PDF or DOCX</div>}
                    {resume && <div className="ax-cluster" style={{ gap: 6, color: 'var(--ax-viz-emerald)' }}><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>aria-voss-resume.pdf</b></div>}
                    <input id="a-resume" type="file" accept=".pdf,.doc,.docx" className="ax-visually-hidden" onChange={() => setResume(true)} />
                  </label>
                </div>
              </div>
              <div className="ax-field" style={{ margin: 0 }}><label className="ax-label" htmlFor="a-cover">Why are you a fit?</label><textarea id="a-cover" className="ax-textarea" rows={3} placeholder="A few lines on why this role excites you…" /></div>
              <div className="ax-cluster" style={{ justifyContent: 'flex-end', gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-1)' }}>
                <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setShowApply(false)}>Cancel</button>
                <button type="submit" className="ax-btn ax-btn--primary">Submit application</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default JobDetails;
