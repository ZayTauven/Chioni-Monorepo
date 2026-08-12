'use client';
/*
 * Vireo React — Terms & Conditions (route "pages/terms").
 *
 * Faithful re-expression of src/html/pages/terms.html: long-form legal document
 * with a sticky TOC rail whose active link tracks the visible section via an
 * IntersectionObserver (Alpine `active`/`init` scroll-spy ported to useEffect).
 * DOM classes / ARIA / copy match the reference 1:1.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const SECTIONS = ['introduction', 'accounts', 'acceptable-use', 'subscriptions', 'intellectual-property', 'termination', 'disclaimers', 'liability', 'changes', 'contact'] as const;

const TOC: { id: string; n: string; label: string }[] = [
  { id: 'introduction', n: '01', label: 'Introduction' },
  { id: 'accounts', n: '02', label: 'Your account' },
  { id: 'acceptable-use', n: '03', label: 'Acceptable use' },
  { id: 'subscriptions', n: '04', label: 'Subscriptions & billing' },
  { id: 'intellectual-property', n: '05', label: 'Intellectual property' },
  { id: 'termination', n: '06', label: 'Termination' },
  { id: 'disclaimers', n: '07', label: 'Disclaimers' },
  { id: 'liability', n: '08', label: 'Limitation of liability' },
  { id: 'changes', n: '09', label: 'Changes to these terms' },
  { id: 'contact', n: '10', label: 'Contact us' },
];

const H2: React.CSSProperties = { fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: '0 0 var(--ax-space-3)' };
const H3: React.CSSProperties = { fontSize: 'var(--ax-text-md)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: 'var(--ax-space-4) 0 var(--ax-space-2)' };
const P: React.CSSProperties = { color: 'var(--ax-text)', lineHeight: 1.7, margin: '0 0 var(--ax-space-3)' };
const P_LAST: React.CSSProperties = { color: 'var(--ax-text)', lineHeight: 1.7, margin: 0 };
const SEC: React.CSSProperties = { scrollMarginTop: 'var(--ax-space-8)' };

export function Terms() {
  const [active, setActive] = useState<string>('introduction');

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const tocLink = (id: string): React.CSSProperties => ({
    display: 'block',
    padding: '6px var(--ax-space-3)',
    borderRadius: 'var(--ax-radius-sm)',
    fontSize: 'var(--ax-text-sm)',
    textDecoration: 'none',
    ...(active === id
      ? { color: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' }
      : { color: 'var(--ax-text-muted)' }),
  });

  return (
    <>
      <PageHead
        title="Terms & Conditions"
        subtitle={
          (
            <>
              <span style={{ color: 'var(--ax-text-muted)' }}>Last updated</span>{' '}
              <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>April 18, 2026</span>
              <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-num" style={{ marginInlineStart: 'var(--ax-space-2)' }}>v3.2</span>
            </>
          ) as unknown as string
        }
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary" onClick={() => window.print()}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" /><path d="M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4" /><path d="M7 15a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2l0 -4" /></svg>
              <span className="ax-btn__label">Print</span>
            </button>
            <a className="ax-btn ax-btn--primary" href="#" download>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Download PDF</span>
            </a>
          </>
        }
      />

      <div className="ax-doc" style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 'var(--ax-space-6)', alignItems: 'start' }}>
        {/* TOC sidebar */}
        <nav className="ax-card ax-doc__toc" aria-label="Table of contents" style={{ position: 'sticky', top: 'var(--ax-space-6)', alignSelf: 'start' }}>
          <div className="ax-card__body" style={{ padding: 'var(--ax-space-5)' }}>
            <p className="ax-card__eyebrow" style={{ marginBottom: 'var(--ax-space-3)' }}>On this page</p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 2, listStyle: 'none', margin: 0, padding: 0 }}>
              {TOC.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="ax-toc__link" style={tocLink(t.id)}>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-subtle)', marginInlineEnd: 6 }}>{t.n}</span>
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* doc body */}
        <article className="ax-card ax-doc__body">
          <div className="ax-card__body" style={{ maxWidth: '72ch', padding: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-7)' }}>
            <div className="ax-alert ax-alert--accent ax-alert--accent-edge" role="note">
              <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>
              <div className="ax-alert__content">
                <p className="ax-alert__message" style={{ color: 'var(--ax-text)' }}>These terms are a demonstration of the Vireo long-form document template. Please replace this copy with your own legal text before going to production.</p>
              </div>
            </div>

            <section id="introduction" style={SEC}>
              <h2 style={H2}>1. Introduction</h2>
              <p style={P}>Welcome to Vireo. These Terms &amp; Conditions ("Terms") govern your access to and use of the Vireo platform, websites and related services (collectively, the "Service") operated by Vireo, Inc. ("Vireo", "we", "us").</p>
              <p style={P_LAST}>By creating an account or otherwise using the Service, you agree to be bound by these Terms. If you are entering into these Terms on behalf of a company or other legal entity, you represent that you have the authority to bind that entity.</p>
            </section>

            <section id="accounts" style={SEC}>
              <h2 style={H2}>2. Your account</h2>
              <p style={P}>To use most features of the Service you must register for an account. You agree to provide accurate, current and complete information and to keep it up to date.</p>
              <h3 style={H3}>2.1 Account security</h3>
              <p style={P}>You are responsible for safeguarding your credentials and for all activity that occurs under your account. Notify us immediately at security@vireo.io if you suspect unauthorized access.</p>
              <h3 style={H3}>2.2 Eligibility</h3>
              <p style={P_LAST}>You must be at least 16 years old to use the Service. By using it you represent that you meet this requirement.</p>
            </section>

            <section id="acceptable-use" style={SEC}>
              <h2 style={H2}>3. Acceptable use</h2>
              <p style={P}>You agree not to misuse the Service. In particular, you may not:</p>
              <ul style={{ color: 'var(--ax-text)', lineHeight: 1.7, margin: 0, paddingInlineStart: 'var(--ax-space-5)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>use the Service for any unlawful, harmful or fraudulent purpose;</li>
                <li>attempt to gain unauthorized access to any system or data;</li>
                <li>interfere with or disrupt the integrity or performance of the Service;</li>
                <li>reverse engineer any part of the Service except as permitted by law;</li>
                <li>resell or sublicense the Service without our written consent.</li>
              </ul>
            </section>

            <section id="subscriptions" style={SEC}>
              <h2 style={H2}>4. Subscriptions &amp; billing</h2>
              <p style={P}>Paid plans are billed in advance on a monthly or annual basis and are non-refundable except as expressly stated in these Terms or required by law. Fees are exclusive of taxes.</p>
              <p style={P_LAST}>Your subscription renews automatically unless cancelled before the renewal date. You can manage or cancel your plan at any time from your billing settings. See our <Link className="ax-link" href="/pages/pricing">pricing page</Link> for current rates.</p>
            </section>

            <section id="intellectual-property" style={SEC}>
              <h2 style={H2}>5. Intellectual property</h2>
              <p style={P}>The Service and all related software, design and content are the property of Vireo and its licensors and are protected by intellectual property laws. We grant you a limited, non-exclusive, non-transferable license to use the Service in accordance with these Terms.</p>
              <p style={P_LAST}>You retain all rights to the content you upload. By uploading content you grant us a license to host, process and display it solely to provide the Service to you.</p>
            </section>

            <section id="termination" style={SEC}>
              <h2 style={H2}>6. Termination</h2>
              <p style={P_LAST}>You may stop using the Service at any time. We may suspend or terminate your access if you breach these Terms, fail to pay fees when due, or if required by law. Upon termination your right to use the Service ceases immediately, and we will make your data available for export for 30 days.</p>
            </section>

            <section id="disclaimers" style={SEC}>
              <h2 style={H2}>7. Disclaimers</h2>
              <p style={P_LAST}>The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the Service will be uninterrupted or error-free.</p>
            </section>

            <section id="liability" style={SEC}>
              <h2 style={H2}>8. Limitation of liability</h2>
              <p style={P_LAST}>To the maximum extent permitted by law, Vireo will not be liable for any indirect, incidental, special, consequential or punitive damages, or any loss of profits or revenues. Our total liability for any claim arising out of these Terms is limited to the amount you paid us in the twelve months preceding the claim.</p>
            </section>

            <section id="changes" style={SEC}>
              <h2 style={H2}>9. Changes to these terms</h2>
              <p style={P_LAST}>We may update these Terms from time to time. If we make material changes we will notify you by email or through the Service at least 30 days before they take effect. Your continued use after the effective date constitutes acceptance of the revised Terms.</p>
            </section>

            <section id="contact" style={SEC}>
              <h2 style={H2}>10. Contact us</h2>
              <p style={{ color: 'var(--ax-text)', lineHeight: 1.7, margin: '0 0 var(--ax-space-4)' }}>If you have any questions about these Terms, please reach out:</p>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'center' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></span>
                <div>
                  <p style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>legal@vireo.io</p>
                  <p style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Vireo, Inc. · 2261 Market Street, San Francisco, CA</p>
                </div>
              </div>
            </section>

            <div className="ax-divider" style={{ borderTop: '1px solid var(--ax-border)', margin: 'var(--ax-space-2) 0' }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <Link className="ax-link" href="/pages/privacy">Read our Privacy Policy →</Link>
              <a className="ax-btn ax-btn--ghost ax-btn--sm" href="#ax-main">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M18 11l-6 -6" /><path d="M6 11l6 -6" /></svg>
                <span className="ax-btn__label">Back to top</span>
              </a>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}

export default Terms;
