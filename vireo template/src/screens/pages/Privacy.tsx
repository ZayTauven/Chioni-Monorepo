'use client';
/*
 * Vireo React — Privacy Policy (route "pages/privacy").
 *
 * Faithful re-expression of src/html/pages/privacy.html: a long-form legal
 * document with a sticky TOC rail whose active link tracks the visible section
 * via an IntersectionObserver (the Alpine `active`/`init` scroll-spy, ported to
 * a useEffect). DOM classes / ARIA / copy match the reference 1:1.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const SECTIONS = ['collect', 'use', 'cookies', 'sharing', 'retention', 'rights', 'transfers', 'children', 'changes', 'contact'] as const;

const TOC: { id: string; n: string; label: string }[] = [
  { id: 'collect', n: '01', label: 'Information we collect' },
  { id: 'use', n: '02', label: 'How we use it' },
  { id: 'cookies', n: '03', label: 'Cookies & tracking' },
  { id: 'sharing', n: '04', label: 'Data sharing' },
  { id: 'retention', n: '05', label: 'Data retention' },
  { id: 'rights', n: '06', label: 'Your rights' },
  { id: 'transfers', n: '07', label: 'International transfers' },
  { id: 'children', n: '08', label: "Children's privacy" },
  { id: 'changes', n: '09', label: 'Changes to this policy' },
  { id: 'contact', n: '10', label: 'Contact us' },
];

const H2: React.CSSProperties = { fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: '0 0 var(--ax-space-3)' };
const H3: React.CSSProperties = { fontSize: 'var(--ax-text-md)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: 'var(--ax-space-4) 0 var(--ax-space-2)' };
const P: React.CSSProperties = { color: 'var(--ax-text)', lineHeight: 1.7, margin: '0 0 var(--ax-space-3)' };
const P_LAST: React.CSSProperties = { color: 'var(--ax-text)', lineHeight: 1.7, margin: 0 };
const SEC: React.CSSProperties = { scrollMarginTop: 'var(--ax-space-8)' };

export function Privacy() {
  const [active, setActive] = useState<string>('collect');
  const bodyRef = useRef<HTMLDivElement>(null);

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
        title="Privacy Policy"
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
          <div ref={bodyRef} className="ax-card__body" style={{ maxWidth: '72ch', padding: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-7)' }}>
            <div className="ax-alert ax-alert--accent ax-alert--accent-edge" role="note">
              <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /></svg>
              <div className="ax-alert__content">
                <p className="ax-alert__message" style={{ color: 'var(--ax-text)' }}>Your privacy matters to us. This policy explains what we collect, why, and the choices you have. It is provided as template copy — replace it with your own before production.</p>
              </div>
            </div>

            <section id="collect" style={SEC}>
              <h2 style={H2}>1. Information we collect</h2>
              <p style={P}>We collect information you provide directly, information generated automatically as you use the Service, and information from third parties.</p>
              <h3 style={H3}>1.1 Information you provide</h3>
              <p style={P}>Account details such as your name, email address and password, billing information, and any content you upload to the Service.</p>
              <h3 style={H3}>1.2 Information collected automatically</h3>
              <p style={P_LAST}>Device and log data, including IP address, browser type, pages viewed, and timestamps, collected to operate and secure the Service.</p>
            </section>

            <section id="use" style={SEC}>
              <h2 style={H2}>2. How we use it</h2>
              <p style={P}>We use the information we collect to:</p>
              <ul style={{ color: 'var(--ax-text)', lineHeight: 1.7, margin: 0, paddingInlineStart: 'var(--ax-space-5)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>provide, maintain and improve the Service;</li>
                <li>process transactions and send related information;</li>
                <li>detect, prevent and address fraud and security issues;</li>
                <li>communicate with you about updates and support;</li>
                <li>comply with legal obligations.</li>
              </ul>
            </section>

            <section id="cookies" style={SEC}>
              <h2 style={H2}>3. Cookies &amp; tracking</h2>
              <p style={P_LAST}>We use cookies and similar technologies to keep you signed in, remember your preferences and understand how the Service is used. You can control non-essential cookies through your browser or our cookie banner. Disabling essential cookies may impair functionality.</p>
            </section>

            <section id="sharing" style={SEC}>
              <h2 style={H2}>4. Data sharing</h2>
              <p style={P_LAST}>We do not sell your personal data. We share information only with service providers who process it on our behalf under strict contractual safeguards, with your consent, or when required by law. A current list of subprocessors is available on request.</p>
            </section>

            <section id="retention" style={SEC}>
              <h2 style={H2}>5. Data retention</h2>
              <p style={P_LAST}>We retain personal data for as long as your account is active or as needed to provide the Service. After account closure we delete or anonymize data within 90 days, except where a longer period is required for legal, accounting or security purposes.</p>
            </section>

            <section id="rights" style={SEC}>
              <h2 style={H2}>6. Your rights</h2>
              <p style={P}>Depending on your location, you may have the right to access, correct, delete or port your personal data, and to object to or restrict certain processing.</p>
              <p style={P_LAST}>To exercise these rights, contact us at privacy@vireo.io. We will respond within the time required by applicable law, typically within 30 days.</p>
            </section>

            <section id="transfers" style={SEC}>
              <h2 style={H2}>7. International transfers</h2>
              <p style={P_LAST}>We may transfer and process your data in countries other than your own. When we do, we rely on appropriate safeguards such as Standard Contractual Clauses to ensure your data receives an adequate level of protection.</p>
            </section>

            <section id="children" style={SEC}>
              <h2 style={H2}>8. Children's privacy</h2>
              <p style={P_LAST}>The Service is not directed to children under 16, and we do not knowingly collect personal data from them. If you believe a child has provided us with personal data, contact us and we will delete it promptly.</p>
            </section>

            <section id="changes" style={SEC}>
              <h2 style={H2}>9. Changes to this policy</h2>
              <p style={P_LAST}>We may update this Privacy Policy from time to time. When we make material changes we will notify you by email or through the Service and update the "Last updated" date above. Please review it periodically.</p>
            </section>

            <section id="contact" style={SEC}>
              <h2 style={H2}>10. Contact us</h2>
              <p style={{ color: 'var(--ax-text)', lineHeight: 1.7, margin: '0 0 var(--ax-space-4)' }}>Questions about this policy or your data? Reach our privacy team:</p>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'center' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></span>
                <div>
                  <p style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>privacy@vireo.io</p>
                  <p style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Vireo, Inc. · Data Protection Officer · San Francisco, CA</p>
                </div>
              </div>
            </section>

            <div className="ax-divider" style={{ borderTop: '1px solid var(--ax-border)', margin: 'var(--ax-space-2) 0' }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <Link className="ax-link" href="/pages/terms">Read our Terms &amp; Conditions →</Link>
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

export default Privacy;
