'use client';
/*
 * Chioni — public landing page (route "/", bare group).
 *
 * Adapted from the Vireo landing, deliberately LIGHT (no charts, no images,
 * no logo strip / pricing / FAQ): sticky nav, hero pitch, a static stylised
 * dual-currency receipt as the hero visual, 3 benefit blocks (centres /
 * patients / diaspora), a CTA band and a minimal footer.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCustomizer } from '../../context/CustomizerContext';

const BRAND_MARK = (
  <svg viewBox="0 0 32 32" width={22} height={22} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

const CHECK = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="var(--ax-viz-emerald)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
);

interface Benefit {
  title: string;
  text: string;
  points: string[];
  icon: React.ReactNode;
}

const BENEFITS: Benefit[] = [
  {
    title: 'Centres de santé',
    text: 'Un outil complet de gestion du centre : patients, consultations, factures et encaissements — et l’argent de la diaspora arrive directement sur le compte du centre.',
    points: ['Dossiers patients et consultations', 'Facturation claire, acte par acte', 'Paiements reçus à 100 % en francs comoriens'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={26} height={26} aria-hidden="true"><path d="M3 21l18 0" /><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16" /><path d="M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4" /><path d="M10 9l4 0" /><path d="M12 7l0 4" /></svg>
    ),
  },
  {
    title: 'Patients',
    text: 'Votre carnet de santé vous appartient. Vous choisissez ce que vous partagez avec vos proches, et vous pouvez changer d’avis à tout moment.',
    points: ['Carnet de santé personnel et privé', 'Partage des paiements sans dévoiler les soins', 'Vous confirmez qui peut vous aider'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={26} height={26} aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>
    ),
  },
  {
    title: 'Proches à l’étranger',
    text: 'Vous payez le centre de santé, jamais un intermédiaire. Le taux de change est affiché avant de payer, et chaque paiement produit un reçu en deux devises.',
    points: ['Paiement direct au centre de santé', 'Taux de change fixé avant de payer', 'Un reçu pour chaque franc envoyé'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={26} height={26} aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /><path d="M12 6l-3.293 3.293a1 1 0 0 0 0 1.414l.543 .543c.69 .69 1.81 .69 2.5 0l1 -1a3.182 3.182 0 0 1 4.5 0l2.25 2.25" /><path d="M12.5 15.5l2 2" /><path d="M15 13l2 2" /></svg>
    ),
  },
];

/** Static stylised dual-currency receipt — the product's promise in one visual. */
function FakeReceipt() {
  const row = { display: 'flex', justifyContent: 'space-between', gap: 'var(--ax-space-3)', fontSize: 'var(--ax-text-sm)' } as const;
  return (
    <div className="ax-card" role="img" aria-label="Exemple de reçu : un paiement de la diaspora relié à un acte de soin et reçu par le centre en francs comoriens" style={{ width: '100%', maxWidth: 420, textAlign: 'start', boxShadow: 'var(--ax-shadow-card)' }}>
      <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 600, color: 'var(--ax-text-strong)' }}>Reçu officiel</span>
          <span className="ax-mono" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>N° MOR-2026-0142</span>
        </div>
        <hr className="ax-divider" aria-hidden="true" />
        <div style={row}><span style={{ color: 'var(--ax-text-muted)' }}>Centre de santé</span><b style={{ color: 'var(--ax-text-strong)' }}>Centre médical de Moroni</b></div>
        <div style={row}><span style={{ color: 'var(--ax-text-muted)' }}>Acte</span><b style={{ color: 'var(--ax-text-strong)' }}>Consultation</b></div>
        <div style={row}><span style={{ color: 'var(--ax-text-muted)' }}>Payé par</span><b style={{ color: 'var(--ax-text-strong)' }}>Un proche en France</b></div>
        <hr className="ax-divider" aria-hidden="true" />
        <div style={row}><span style={{ color: 'var(--ax-text-muted)' }}>Montant payé</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>31,20 €</b></div>
        <div style={row}><span style={{ color: 'var(--ax-text-muted)' }}>Reçu par le centre</span><b className="ax-num" style={{ color: 'var(--ax-accent)' }}>15 000 KMF</b></div>
        <div style={row}><span style={{ color: 'var(--ax-text-muted)' }}>Taux appliqué</span><span className="ax-num" style={{ color: 'var(--ax-text)' }}>1 € = 491,97 KMF</span></div>
        <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill" style={{ alignSelf: 'flex-start', marginTop: 'var(--ax-space-1)' }}>
          <span className="ax-badge__dot" />Soin confirmé par le centre
        </span>
      </div>
    </div>
  );
}

const linkStyle = { color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)' } as const;

export function Landing() {
  const { themeResolved, toggleTheme } = useCustomizer();
  const [scrolled, setScrolled] = useState(false);

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
      {/* ════════ NAV (sticky) ════════ */}
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
        <nav className="ax-cluster" aria-label="Navigation principale" style={{ maxWidth: 1100, marginInline: 'auto', padding: 'var(--ax-space-4) var(--ax-space-5)', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <Link href="/" className="ax-cluster" aria-label="Accueil Chioni" style={{ gap: 'var(--ax-space-3)', textDecoration: 'none', flexWrap: 'nowrap' }}>
            <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>{BRAND_MARK}</span>
            <span style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 'var(--ax-weight-semibold)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>Chioni</span>
          </Link>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" onClick={toggleTheme} aria-pressed={themeResolved === 'dark'} aria-label="Basculer le mode sombre">
              {themeResolved === 'dark'
                ? <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></svg>
                : <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></svg>}
            </button>
            <Link className="ax-btn ax-btn--primary ax-btn--sm" href="/auth/sign-in"><span className="ax-btn__label">Se connecter</span></Link>
          </div>
        </nav>
      </header>

      <main id="ax-main" style={{ position: 'relative', zIndex: 1 }}>

        {/* ════════ HERO ════════ */}
        <section style={{ maxWidth: 1100, marginInline: 'auto', padding: 'var(--ax-space-10) var(--ax-space-5) var(--ax-space-9)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-5)' }}>
          <h1 style={{ margin: 0, maxWidth: '22ch', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, lineHeight: 1.12, letterSpacing: '-.02em', color: 'var(--ax-text-strong)' }}>
            Le lien de confiance entre la diaspora et les centres de santé comoriens
          </h1>
          <p style={{ margin: 0, maxWidth: '52ch', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
            Depuis l&rsquo;étranger, vous payez les soins d&rsquo;un proche directement au centre de santé.
            Chaque franc est relié à un patient, un acte et un reçu — jamais d&rsquo;intermédiaire.
          </p>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', justifyContent: 'center' }}>
            <Link className="ax-btn ax-btn--primary ax-btn--lg" href="/auth/sign-in"><span className="ax-btn__label">Commencer</span></Link>
            <a className="ax-btn ax-btn--secondary ax-btn--lg" href="#benefices" onClick={(e) => smoothTo(e, 'benefices')}><span className="ax-btn__label">Comment ça marche</span></a>
          </div>
          <div style={{ marginTop: 'var(--ax-space-5)', display: 'flex', justifyContent: 'center', width: '100%' }}>
            <FakeReceipt />
          </div>
        </section>

        {/* ════════ BENEFITS ════════ */}
        <section id="benefices" style={{ maxWidth: 1100, marginInline: 'auto', padding: 'var(--ax-space-9) var(--ax-space-5)', scrollMarginTop: 80 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--ax-space-8)' }}>
            <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>Pour qui ?</span>
            <h2 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Un outil pensé pour les trois</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 'var(--ax-space-5)', alignItems: 'stretch' }}>
            {BENEFITS.map((b) => (
              <div key={b.title} className="ax-card" role="region" aria-label={b.title} style={{ margin: 0 }}>
                <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                  <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>{b.icon}</span>
                  <h3 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{b.title}</h3>
                  <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>{b.text}</p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                    {b.points.map((p) => (
                      <li key={p} className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0, marginTop: 3 }}>{CHECK}</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════ CTA BAND ════════ */}
        <section aria-label="Commencer" style={{ maxWidth: 1100, marginInline: 'auto', padding: '0 var(--ax-space-5) var(--ax-space-10)' }}>
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--ax-radius-xl)', padding: 'var(--ax-space-9) var(--ax-space-5)', textAlign: 'center', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 24px 60px -24px rgba(var(--ax-accent-rgb),.6)' }}>
            <span aria-hidden="true" style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.14)' }} />
            <span aria-hidden="true" style={{ position: 'absolute', bottom: -80, left: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.10)' }} />
            <h2 style={{ margin: 0, position: 'relative', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, letterSpacing: '-.015em', color: 'var(--ax-on-accent)' }}>Aider mieux, en toute confiance</h2>
            <p style={{ margin: 'var(--ax-space-3) auto var(--ax-space-5)', position: 'relative', maxWidth: '46ch', fontSize: 'var(--ax-text-md)', opacity: 0.92 }}>
              La connexion se fait en deux minutes, avec un simple code reçu par SMS.
            </p>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', justifyContent: 'center', position: 'relative' }}>
              <Link className="ax-btn ax-btn--solid ax-btn--lg" href="/auth/sign-in"><span className="ax-btn__label">Se connecter</span></Link>
            </div>
          </div>
        </section>

        {/* ════════ FOOTER ════════ */}
        <footer role="contentinfo" style={{ borderBlockStart: '1px solid var(--ax-border)' }}>
          <div className="ax-cluster" style={{ maxWidth: 1100, marginInline: 'auto', padding: 'var(--ax-space-6) var(--ax-space-5)', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <span className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>© 2026 Chioni</span>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)' }}>
              <Link className="ax-link" href="/auth/sign-in" style={linkStyle}>Se connecter</Link>
              <Link className="ax-link" href="/auth/staff" style={linkStyle}>Personnel de santé</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

export default Landing;
