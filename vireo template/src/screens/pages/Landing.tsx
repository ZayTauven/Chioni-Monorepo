'use client';
/*
 * Vireo Next.js — Pages / Landing (route "pages/landing", BARE / marketing group).
 *
 * Faithful re-expression of src/html/pages/landing.html: a marketing site with a
 * sticky glass nav (theme toggle + sign-in/get-started), hero with a live area
 * chart in a browser frame, logo strip, alternating feature blocks (one with a
 * live accent picker), a stats band, monthly/annual pricing, an accordion FAQ, a
 * saturated CTA band and a marketing footer. The Alpine axLanding() state
 * (scroll, billing toggle, accordion, smooth-scroll, theme toggle) is ported to
 * React; the theme toggle + accent picker route through useCustomizer() (the
 * shared code path). Charts go through <ApexChart>. Renders without the app
 * shell. DOM/classes/ARIA match the reference 1:1.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApexChart } from '../../components/charts/ApexChart';
import { useCustomizer } from '../../context/CustomizerContext';

const CHECK = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="var(--ax-viz-emerald)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
);

const BRAND_MARK = (
  <svg viewBox="0 0 32 32" width={22} height={22} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

const ACCENTS = ['verdigris', 'cobalt', 'indigo', 'amethyst', 'magenta', 'terracotta', 'amber', 'olive', 'forest', 'teal', 'slate', 'graphite'];

const LOGOS: { name: string; path: React.ReactNode }[] = [
  { name: 'Northwind', path: <path d="M12 3l9 4.5v9l-9 4.5l-9 -4.5v-9z" /> },
  { name: 'Helio', path: <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 3v18" /></> },
  { name: 'Vantage', path: <><path d="M4 7l16 0" /><path d="M10 11l4 6" /><path d="M14 11l-4 6" /></> },
  { name: 'Quanta', path: <><path d="M12 3l4 7h-8z" /><path d="M12 21l-4 -7h8z" /></> },
  { name: 'Lumen', path: <><path d="M5 12a7 7 0 1 0 14 0a7 7 0 0 0 -14 0" /><path d="M12 5v14" /></> },
];

interface Plan {
  label: string; sub: string; monthly: string; annual: string; annualTotal: string;
  features: string[]; cta: string; primary: boolean; popular?: boolean; ariaLabel: string;
}
const PLANS: Plan[] = [
  { label: 'Starter', sub: 'For solo builders & prototypes.', monthly: '29', annual: '23', annualTotal: '$276 billed annually', features: ['1 project', 'HTML edition', 'Community support'], cta: 'Choose Starter', primary: false, ariaLabel: 'Starter plan' },
  { label: 'Pro', sub: 'For teams shipping product.', monthly: '79', annual: '63', annualTotal: '$756 billed annually', features: ['Unlimited projects', 'All 9 framework editions', 'Priority email support', 'Figma source files'], cta: 'Choose Pro', primary: true, popular: true, ariaLabel: 'Pro plan, most popular' },
  { label: 'Business', sub: 'For organizations at scale.', monthly: '199', annual: '159', annualTotal: '$1,908 billed annually', features: ['Everything in Pro', 'SSO & audit log', 'Dedicated success manager'], cta: 'Contact sales', primary: false, ariaLabel: 'Business plan' },
];

const FAQS = [
  { q: 'Which frameworks are included?', a: 'Vireo ships in nine editions — plain HTML, React, Next.js, Vue, Nuxt, Angular, Laravel, Django and PHP — all sharing one token-driven design system.' },
  { q: 'Do dark mode and accents really work everywhere?', a: 'Yes. Every surface reads from role tokens, so light, dark and all twelve accents apply to components, charts and badges with zero per-component overrides.' },
  { q: 'Can I use Vireo in a commercial product?', a: 'Absolutely. A single license covers unlimited end products you build and sell, across every framework edition.' },
  { q: 'Is it accessible out of the box?', a: 'Components ship with semantic landmarks, focus-visible rings, ARIA wiring and AA contrast in both themes — verified at a 100 Lighthouse accessibility score.' },
];

const linkStyle = { color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)' } as const;

export function Landing() {
  const { themeResolved, toggleTheme, accent, setAccent } = useCustomizer();
  const [scrolled, setScrolled] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [open, setOpen] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const smoothTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <>
      {/* ════════ MARKETING NAV (sticky) ════════ */}
      <header
        className={`ax-glass${scrolled ? ' is-scrolled' : ''}`}
        role="banner"
        style={{
          position: 'sticky', top: 0, zIndex: 40, borderRadius: 0, borderInline: 0, borderBlockStart: 0,
          transition: 'background-color var(--ax-motion-base) var(--ax-ease-standard),box-shadow var(--ax-motion-base) var(--ax-ease-standard),border-color var(--ax-motion-base) var(--ax-ease-standard)',
          borderBlockEnd: scrolled ? '1px solid var(--ax-border)' : '1px solid transparent',
          ...(scrolled ? {} : { background: 'transparent', boxShadow: 'none' }),
        }}
      >
        <nav className="ax-cluster" aria-label="Primary" style={{ maxWidth: 1200, marginInline: 'auto', padding: 'var(--ax-space-4) var(--ax-space-6)', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <Link href="/pages/landing" className="ax-cluster" aria-label="Vireo home" style={{ gap: 'var(--ax-space-3)', textDecoration: 'none', flexWrap: 'nowrap' }}>
            <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>{BRAND_MARK}</span>
            <span style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 'var(--ax-weight-semibold)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>Vireo</span>
          </Link>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', flexWrap: 'nowrap' }}>
            <div className="ax-cluster ax-nav-desktop" style={{ gap: 'var(--ax-space-5)' }}>
              <a className="ax-link" href="#features" style={linkStyle} onClick={(e) => smoothTo(e, 'features')}>Features</a>
              <a className="ax-link" href="#stats" style={linkStyle} onClick={(e) => smoothTo(e, 'stats')}>Showcase</a>
              <a className="ax-link" href="#pricing" style={linkStyle} onClick={(e) => smoothTo(e, 'pricing')}>Pricing</a>
              <a className="ax-link" href="#faq" style={linkStyle} onClick={(e) => smoothTo(e, 'faq')}>FAQ</a>
            </div>
          </div>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" onClick={toggleTheme} aria-pressed={themeResolved === 'dark'} aria-label="Toggle dark mode">
              {themeResolved === 'dark'
                ? <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></svg>
                : <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></svg>}
            </button>
            <a className="ax-btn ax-btn--ghost ax-btn--sm" href="#"><span className="ax-btn__label">Sign in</span></a>
            <a className="ax-btn ax-btn--primary ax-btn--sm" href="#"><span className="ax-btn__label">Get started</span></a>
          </div>
        </nav>
      </header>

      <main id="ax-main" style={{ position: 'relative', zIndex: 1 }}>

        {/* ════════ HERO ════════ */}
        <section style={{ maxWidth: 1200, marginInline: 'auto', padding: 'var(--ax-space-12) var(--ax-space-6) var(--ax-space-10)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-5)' }}>
          <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill"><span className="ax-badge__dot" />Aurora 2.4 is live</span>
          <h1 style={{ margin: 0, maxWidth: '18ch', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, lineHeight: 1.08, letterSpacing: '-.02em', color: 'var(--ax-text-strong)' }}>
            The admin dashboard your team will <span style={{ position: 'relative', whiteSpace: 'nowrap', color: 'var(--ax-accent)' }}>actually use<svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: -6, width: '100%', height: 10 }}><path d="M2 8 Q 50 2 100 6 T 198 5" fill="none" stroke="var(--ax-accent)" strokeWidth={3} strokeLinecap="round" /></svg></span>.
          </h1>
          <p style={{ margin: 0, maxWidth: '54ch', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
            Vireo ships 17 dashboards, 8 web apps and a full eCommerce suite in one glassy, token-driven design system — light, dark and twelve accents, all out of the box.
          </p>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', justifyContent: 'center' }}>
            <a className="ax-btn ax-btn--primary ax-btn--lg" href="#"><span className="ax-btn__label">Start free trial</span><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg></a>
            <Link className="ax-btn ax-btn--secondary ax-btn--lg" href="/"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16l13 -8z" /></svg><span className="ax-btn__label">Live demo</span></Link>
          </div>
          <p className="ax-num" style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>No card required · 14-day trial · cancel anytime</p>

          {/* product mockup in a hairline browser frame */}
          <div className="ax-glass" style={{ marginTop: 'var(--ax-space-6)', width: '100%', maxWidth: 980, borderRadius: 'var(--ax-radius-xl)', overflow: 'hidden', boxShadow: 'var(--ax-shadow-card)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', padding: 'var(--ax-space-3) var(--ax-space-4)', borderBlockEnd: '1px solid var(--ax-border)' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--ax-viz-red)' }} />
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--ax-viz-amber)' }} />
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--ax-viz-emerald)' }} />
              <span className="ax-num" style={{ marginInlineStart: 'var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)' }}>app.vireo.io/dashboards/sales</span>
            </div>
            <div style={{ padding: 'var(--ax-space-5)', background: 'var(--ax-canvas)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--ax-space-3)', marginBottom: 'var(--ax-space-4)' }}>
                {[['Revenue', '$748K'], ['Customers', '3,920'], ['Orders', '9,812'], ['Refunds', '1.2%']].map(([lbl, val]) => (
                  <div key={lbl} className="ax-card" style={{ padding: 'var(--ax-space-3)' }}>
                    <div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{lbl}</div>
                    <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 700, fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="ax-card" style={{ padding: 'var(--ax-space-4)' }}>
                <ApexChart
                  type="area"
                  height={200}
                  legend="none"
                  color="--ax-chart-1"
                  ariaLabel="Sample revenue chart"
                  series={[{ name: 'This year', data: [28, 34, 30, 42, 38, 52, 48, 60, 56, 68, 64, 74] }]}
                  apex={{ stroke: { width: 2.5 } }}
                  style={{ minHeight: 200 }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ════════ LOGO STRIP ════════ */}
        <section aria-label="Trusted by" style={{ maxWidth: 1100, marginInline: 'auto', padding: '0 var(--ax-space-6) var(--ax-space-10)', textAlign: 'center' }}>
          <p style={{ margin: '0 0 var(--ax-space-5)', fontSize: 'var(--ax-text-xs)', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ax-text-subtle)' }}>Trusted by product teams at</p>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-8)', justifyContent: 'center', flexWrap: 'wrap', color: 'var(--ax-text-subtle)' }}>
            {LOGOS.map((l) => (
              <span key={l.name} className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontFamily: 'var(--ax-font-display)', fontWeight: 600, fontSize: 'var(--ax-text-md)' }}>
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{l.path}</svg>{l.name}
              </span>
            ))}
          </div>
        </section>

        {/* ════════ FEATURE BLOCKS ════════ */}
        <section id="features" style={{ maxWidth: 1100, marginInline: 'auto', padding: 'var(--ax-space-10) var(--ax-space-6)', scrollMarginTop: 80 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--ax-space-9)' }}>
            <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>Why Vireo</span>
            <h2 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Everything is a token away</h2>
            <p style={{ margin: 'var(--ax-space-3) auto 0', maxWidth: '50ch', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)' }}>A single role-token layer drives every surface — so themes, accents and dark mode just work.</p>
          </div>

          {/* Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'var(--ax-space-8)', alignItems: 'center', marginBottom: 'var(--ax-space-10)' }}>
            <div>
              <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', marginBottom: 'var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3h7v9h-7z" /><path d="M14 3h7v5h-7z" /><path d="M14 12h7v9h-7z" /><path d="M3 16h7v5h-7z" /></svg></span>
              <h3 style={{ margin: '0 0 var(--ax-space-2)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>17 ready-made dashboards</h3>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>Sales, analytics, CRM, crypto, healthcare, HR and more — each a complete, considered layout you can ship today or remix tomorrow.</p>
              <ul style={{ margin: 'var(--ax-space-4) 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                <li className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{CHECK}Real demo data on every screen</li>
                <li className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{CHECK}Charts that re-theme automatically</li>
              </ul>
            </div>
            <div className="ax-glass" style={{ borderRadius: 'var(--ax-radius-xl)', padding: 'var(--ax-space-5)' }}>
              <ApexChart
                type="bar"
                height={220}
                legend="none"
                accent
                ariaLabel="Sample bar chart"
                series={[{ name: 'Active', data: [44, 55, 41, 67, 52, 72, 58] }]}
              />
            </div>
          </div>

          {/* Row 2 (reversed) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'var(--ax-space-8)', alignItems: 'center' }}>
            <div className="ax-glass" style={{ borderRadius: 'var(--ax-radius-xl)', padding: 'var(--ax-space-5)', order: 2 }}>
              <p style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Try an accent — the whole page retheme is live:</p>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }} role="group" aria-label="Accent preset picker">
                {ACCENTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAccent(a)}
                    aria-pressed={accent === a}
                    aria-label={`Use ${a} accent`}
                    data-ax-accent={a}
                    style={{ position: 'relative', width: 40, height: 40, borderRadius: 'var(--ax-radius-md)', cursor: 'pointer', border: '1px solid var(--ax-border)', background: 'var(--ax-accent)' }}
                  >
                    {accent === a && (
                      <span className="ax-grid" aria-hidden="true" style={{ position: 'absolute', inset: 0, placeItems: 'center', color: 'var(--ax-on-accent)' }}><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5l10 -10" /></svg></span>
                    )}
                  </button>
                ))}
              </div>
              <p className="ax-num" style={{ margin: 'var(--ax-space-4) 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)' }}>12 accent presets · light + dark · WCAG AA</p>
            </div>
            <div style={{ order: 1 }}>
              <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)', marginBottom: 'var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 0 1 0 -18a9 8 0 0 1 9 8a4.5 4 0 0 1 -4.5 4h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" /><path d="M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg></span>
              <h3 style={{ margin: '0 0 var(--ax-space-2)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Themeable to the pixel</h3>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>Pick from twelve curated accents or set your own brand color in the live customizer. Every component, chart and badge follows instantly — no overrides.</p>
            </div>
          </div>
        </section>

        {/* ════════ STATS BAND ════════ */}
        <section id="stats" aria-label="By the numbers" style={{ borderBlock: '1px solid var(--ax-border)', scrollMarginTop: 80 }}>
          <div style={{ maxWidth: 1100, marginInline: 'auto', padding: 'var(--ax-space-9) var(--ax-space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--ax-space-6)', textAlign: 'center' }}>
            {[['210+', 'pre-built pages'], ['9', 'framework editions'], ['12', 'accent presets'], ['100', 'Lighthouse a11y']].map(([n, l]) => (
              <div key={l}>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>{n}</div>
                <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════ PRICING ════════ */}
        <section id="pricing" style={{ maxWidth: 1100, marginInline: 'auto', padding: 'var(--ax-space-10) var(--ax-space-6)', scrollMarginTop: 80 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--ax-space-7)' }}>
            <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>Pricing</span>
            <h2 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Simple, honest pricing</h2>
            <p style={{ margin: 'var(--ax-space-3) auto var(--ax-space-5)', maxWidth: '46ch', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)' }}>One license, all editions. Switch to annual and save 20%.</p>
            <div className="ax-segment" role="radiogroup" aria-label="Billing period" style={{ marginInline: 'auto' }}>
              <button type="button" className={`ax-segment__option${billing === 'monthly' ? ' is-active' : ''}`} aria-checked={billing === 'monthly'} role="radio" onClick={() => setBilling('monthly')}>Monthly</button>
              <button type="button" className={`ax-segment__option${billing === 'annual' ? ' is-active' : ''}`} aria-checked={billing === 'annual'} role="radio" onClick={() => setBilling('annual')}>Annual <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--sm" style={{ marginInlineStart: 6 }}>−20%</span></button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 'var(--ax-space-5)', alignItems: 'stretch' }}>
            {PLANS.map((p) => (
              <div key={p.label} className={`ax-card${p.popular ? ' ax-card--accent-edge' : ''}`} role="region" aria-label={p.ariaLabel} style={{ margin: 0, display: 'flex', flexDirection: 'column', ...(p.popular ? { position: 'relative' } : {}) }}>
                {p.popular && <span style={{ position: 'absolute', top: 'var(--ax-space-4)', insetInlineEnd: 'var(--ax-space-4)' }}><span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">Most popular</span></span>}
                <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', flex: '1 1 auto' }}>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{p.label}</h3>
                    <p style={{ margin: 'var(--ax-space-1) 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{p.sub}</p>
                  </div>
                  <div>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>${billing === 'annual' ? p.annual : p.monthly}</span>
                    <span style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-sm)' }}> /mo</span>
                    {billing === 'annual' && <div className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{p.annualTotal}</div>}
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
                    {p.features.map((f) => (
                      <li key={f} className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>{CHECK}{f}</li>
                    ))}
                  </ul>
                  {p.primary
                    ? <a className="ax-btn ax-btn--primary ax-btn--block" href="#" style={{ marginTop: 'auto' }}><span className="ax-btn__label">{p.cta}</span></a>
                    : <a className="ax-btn ax-btn--secondary ax-btn--block" href="#" style={{ marginTop: 'auto' }}><span className="ax-btn__label">{p.cta}</span></a>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════ FAQ ════════ */}
        <section id="faq" style={{ maxWidth: 760, marginInline: 'auto', padding: 'var(--ax-space-10) var(--ax-space-6)', scrollMarginTop: 80 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--ax-space-7)' }}>
            <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>FAQ</span>
            <h2 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Questions, answered</h2>
          </div>
          <div className="ax-accordion ax-accordion--bordered">
            {FAQS.map((q, i) => (
              <div key={i} className="ax-accordion__item">
                <button type="button" className="ax-accordion__header" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} aria-controls={`faq-panel-${i}`}>
                  <span className="ax-accordion__title">{q.q}</span>
                  <svg className="ax-accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
                </button>
                {open === i && (
                  <div className="ax-accordion__panel" id={`faq-panel-${i}`}>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>{q.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ════════ CTA BAND ════════ */}
        <section aria-label="Get started" style={{ maxWidth: 1100, marginInline: 'auto', padding: '0 var(--ax-space-6) var(--ax-space-10)' }}>
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--ax-radius-xl)', padding: 'var(--ax-space-10) var(--ax-space-6)', textAlign: 'center', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 24px 60px -24px rgba(var(--ax-accent-rgb),.6)' }}>
            <span aria-hidden="true" style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.14)' }} />
            <span aria-hidden="true" style={{ position: 'absolute', bottom: -80, left: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.10)' }} />
            <h2 style={{ margin: 0, position: 'relative', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, letterSpacing: '-.015em', color: 'var(--ax-on-accent)' }}>Start building today</h2>
            <p style={{ margin: 'var(--ax-space-3) auto var(--ax-space-5)', position: 'relative', maxWidth: '46ch', fontSize: 'var(--ax-text-md)', opacity: 0.92 }}>Join thousands of teams shipping beautiful, accessible admin interfaces with Vireo.</p>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', justifyContent: 'center', position: 'relative' }}>
              <a className="ax-btn ax-btn--solid ax-btn--lg" href="#"><span className="ax-btn__label">Get started free</span></a>
              <Link className="ax-btn ax-btn--lg" href="/" style={{ background: 'rgba(255,255,255,.16)', color: 'var(--ax-on-accent)', borderColor: 'rgba(255,255,255,.28)' }}><span className="ax-btn__label">View live demo</span></Link>
            </div>
          </div>
        </section>

        {/* ════════ FOOTER (marketing) ════════ */}
        <footer role="contentinfo" style={{ borderBlockStart: '1px solid var(--ax-border)' }}>
          <div style={{ maxWidth: 1100, marginInline: 'auto', padding: 'var(--ax-space-9) var(--ax-space-6) var(--ax-space-6)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4,1fr)', gap: 'var(--ax-space-6)', alignItems: 'start' }}>
              <div>
                <Link href="/pages/landing" className="ax-cluster" aria-label="Vireo home" style={{ gap: 'var(--ax-space-3)', textDecoration: 'none', marginBottom: 'var(--ax-space-3)' }}>
                  <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)' }}><svg viewBox="0 0 32 32" width={20} height={20} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk1" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk1)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg></span>
                  <span style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 'var(--ax-weight-semibold)', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-strong)' }}>Vireo</span>
                </Link>
                <p style={{ margin: 0, maxWidth: '32ch', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>The token-driven admin template for teams who care about craft.</p>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-4)' }}>
                  <a href="#" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Vireo on X"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4l11.733 16h4.267l-11.733 -16z" /><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" /></svg></a>
                  <a href="#" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Vireo on GitHub"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" /></svg></a>
                  <a href="#" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Vireo on Dribbble"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 3.6c5 6 7 10.5 7.5 16.2" /><path d="M6.4 19c3.5 -3.5 6 -6.5 14.5 -6.4" /><path d="M3.1 10.75c5 0 9.814 -.38 15.314 -5" /></svg></a>
                </div>
              </div>
              <nav aria-label="Product">
                <h3 style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ax-text-subtle)' }}>Product</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  <li><a className="ax-link" href="#features" onClick={(e) => smoothTo(e, 'features')} style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Features</a></li>
                  <li><a className="ax-link" href="#pricing" onClick={(e) => smoothTo(e, 'pricing')} style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Pricing</a></li>
                  <li><Link className="ax-link" href="/" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Live demo</Link></li>
                  <li><a className="ax-link" href="#" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Changelog</a></li>
                </ul>
              </nav>
              <nav aria-label="Resources">
                <h3 style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ax-text-subtle)' }}>Resources</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  <li><Link className="ax-link" href="/pages/support" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Documentation</Link></li>
                  <li><Link className="ax-link" href="/pages/faq" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Help center</Link></li>
                  <li><Link className="ax-link" href="/pages/support" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Support</Link></li>
                </ul>
              </nav>
              <nav aria-label="Company">
                <h3 style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ax-text-subtle)' }}>Company</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  <li><a className="ax-link" href="#" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>About</a></li>
                  <li><Link className="ax-link" href="/pages/events" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Events</Link></li>
                  <li><a className="ax-link" href="#" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Careers</a></li>
                </ul>
              </nav>
              <nav aria-label="Legal">
                <h3 style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ax-text-subtle)' }}>Legal</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  <li><Link className="ax-link" href="/pages/terms" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Terms</Link></li>
                  <li><Link className="ax-link" href="/pages/privacy" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Privacy</Link></li>
                </ul>
              </nav>
            </div>
            <hr className="ax-divider" style={{ marginBlock: 'var(--ax-space-6)' }} aria-hidden="true" />
            <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <span className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>© 2026 Vireo · v1.0.0</span>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-1)' }}><svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M3.6 9h16.8" /><path d="M3.6 15h16.8" /><path d="M11.5 3a17 17 0 0 0 0 18" /><path d="M12.5 3a17 17 0 0 1 0 18" /></svg>English</span>
              </div>
            </div>
          </div>
        </footer>
      </main>

      <style>{`
        @media (max-width: 768px) { .ax-nav-desktop { display: none !important; } }
      `}</style>
    </>
  );
}

export default Landing;
