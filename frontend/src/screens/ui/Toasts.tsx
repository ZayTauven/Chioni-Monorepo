'use client';
/*
 * Vireo Next.js — UI · Toasts (route "ui/toasts").
 *
 * Faithful re-expression of src/html/ui/toasts.html: a live trigger card that
 * pushes tone-coded toasts onto a queue (auto-dismiss after 4s) rendered in one
 * of six positions, a positions reference plate, and the static tone/anatomy
 * gallery. The reference's $store.toasts queue + position select are re-expressed
 * with local React state; the page-local timer keyframe is reproduced verbatim.
 * DOM/classes/ARIA/copy match 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const TIMER_CSS = `
@keyframes ax-toast-timer { from { transform:scaleX(1); } to { transform:scaleX(0); } }
@media (prefers-reduced-motion: reduce) { .ax-toast__timer { animation:none !important; } }
`;

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'accent';
interface ToastItem { id: number; tone: Tone; title: string; msg: string; }

const MAP: Record<Tone, { title: string; message: string }> = {
  success: { title: 'Changes saved', message: 'Your report settings were updated.' },
  info: { title: 'Heads up', message: 'A new template is available to import.' },
  warning: { title: 'Storage almost full', message: 'You are using 91% of your plan.' },
  danger: { title: 'Upload failed', message: 'invoice-Q2.pdf could not be processed.' },
  accent: { title: 'Invite sent', message: 'mei.lin@northwindlabs.app was invited.' },
};

function ToastIcon({ tone }: { tone: Tone }) {
  if (tone === 'success') return <svg className="ax-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg>;
  if (tone === 'danger') return <svg className="ax-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>;
  if (tone === 'warning') return <svg className="ax-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg>;
  return <svg className="ax-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>;
}

export function Toasts() {
  const [pos, setPos] = useState('bottom-end');
  const [items, setItems] = useState<ToastItem[]>([]);

  const fire = (tone: Tone) => {
    const t = MAP[tone];
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur, { id, tone, title: t.title, msg: t.message }]);
    window.setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), 4000);
  };
  const dismiss = (id: number) => setItems((cur) => cur.filter((x) => x.id !== id));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TIMER_CSS }} />
      <PageHead
        title="Toasts"
        subtitle="Transient glass notifications — five tones, six positions and a live queue."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/alerts">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
            <span className="ax-btn__label">Alerts</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* Live trigger */}
        <section className="ax-card ax-col--6" role="region" aria-label="Live toast trigger">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Live</span>
              <h2 className="ax-card__title">Trigger a Toast</h2>
              <p className="ax-card__subtitle">Pushes onto the shared queue and auto-dismisses after 4s.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
              <button type="button" className="ax-btn ax-btn--success ax-btn--primary" onClick={() => fire('success')}><span className="ax-btn__label">Success</span></button>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => fire('info')}><span className="ax-btn__label">Info</span></button>
              <button type="button" className="ax-btn ax-btn--warning ax-btn--primary" onClick={() => fire('warning')}><span className="ax-btn__label">Warning</span></button>
              <button type="button" className="ax-btn ax-btn--danger ax-btn--primary" onClick={() => fire('danger')}><span className="ax-btn__label">Danger</span></button>
              <button type="button" className="ax-btn ax-btn--primary" onClick={() => fire('accent')}><span className="ax-btn__label">Accent</span></button>
            </div>
            <div className="ax-field" style={{ margin: 0, maxWidth: 260 }}>
              <label className="ax-label" htmlFor="toast-pos">Position</label>
              <select id="toast-pos" className="ax-select" value={pos} onChange={(e) => setPos(e.target.value)}>
                <option value="bottom-end">Bottom end</option>
                <option value="bottom-start">Bottom start</option>
                <option value="bottom-center">Bottom center</option>
                <option value="top-end">Top end</option>
                <option value="top-start">Top start</option>
                <option value="top-center">Top center</option>
              </select>
              <span className="ax-help">Where the live queue renders on screen.</span>
            </div>

            <div className={`ax-toast-region ax-toast-region--${pos}`} aria-live="polite" aria-atomic="false">
              {items.map((t) => (
                <div key={t.id} className={`ax-toast ax-toast--${t.tone}`} role="status">
                  <ToastIcon tone={t.tone} />
                  <div className="ax-toast__content">
                    <p className="ax-toast__title">{t.title}</p>
                    <p className="ax-toast__message">{t.msg}</p>
                  </div>
                  <button type="button" className="ax-toast__action" onClick={() => dismiss(t.id)}>Undo</button>
                  <button type="button" className="ax-toast__dismiss" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
                  </button>
                  <span className="ax-toast__timer" aria-hidden="true" style={{ animation: 'ax-toast-timer 4s linear forwards' }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Positions reference */}
        <section className="ax-card ax-col--6" role="region" aria-label="Toast positions">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Placement</span>
              <h2 className="ax-card__title">Six Positions</h2>
              <p className="ax-card__subtitle">Top and bottom, paired with start, center or end.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ position: 'relative', height: 240, border: '1px dashed var(--ax-border-strong)', borderRadius: 'var(--ax-radius-lg)', background: 'var(--ax-surface-subtle)', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', insetBlockStart: 10, insetInlineStart: 10, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)', padding: '4px 8px', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)' }}>top-start</span>
              <span style={{ position: 'absolute', insetBlockStart: 10, insetInline: 0, marginInline: 'auto', width: 'max-content', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)', padding: '4px 8px', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)' }}>top-center</span>
              <span style={{ position: 'absolute', insetBlockStart: 10, insetInlineEnd: 10, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)', padding: '4px 8px', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)' }}>top-end</span>
              <span style={{ position: 'absolute', insetBlockEnd: 10, insetInlineStart: 10, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)', padding: '4px 8px', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)' }}>bottom-start</span>
              <span style={{ position: 'absolute', insetBlockEnd: 10, insetInline: 0, marginInline: 'auto', width: 'max-content', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)', padding: '4px 8px', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)' }}>bottom-center</span>
              <span style={{ position: 'absolute', insetBlockEnd: 10, insetInlineEnd: 10, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-accent)', fontWeight: 'var(--ax-weight-semibold)', padding: '4px 8px', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)' }}>bottom-end · default</span>
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Viewport</span>
            </div>
          </div>
        </section>

        {/* Static variants */}
        <section className="ax-card ax-col--12" role="region" aria-label="Toast variants">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Anatomy</span>
              <h2 className="ax-card__title">Tones &amp; Anatomy</h2>
              <p className="ax-card__subtitle">Icon, title, message, optional action and dismiss — shown inline for reference.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 'var(--ax-space-4)' }}>
              <div className="ax-toast ax-toast--success" role="status" style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
                <svg className="ax-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg>
                <div className="ax-toast__content"><p className="ax-toast__title">Changes saved</p><p className="ax-toast__message">Your report settings were updated.</p></div>
                <button type="button" className="ax-toast__dismiss" style={{ opacity: 1 }} aria-label="Dismiss"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
              </div>
              <div className="ax-toast ax-toast--info" role="status" style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
                <svg className="ax-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>
                <div className="ax-toast__content"><p className="ax-toast__title">New template</p><p className="ax-toast__message">&ldquo;Aurora analytics&rdquo; is ready to import.</p></div>
                <button type="button" className="ax-toast__action">Import</button>
              </div>
              <div className="ax-toast ax-toast--warning" role="status" style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
                <svg className="ax-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg>
                <div className="ax-toast__content"><p className="ax-toast__title">Storage almost full</p><p className="ax-toast__message">You are using <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>91%</b> of your plan.</p></div>
                <button type="button" className="ax-toast__action">Upgrade</button>
              </div>
              <div className="ax-toast ax-toast--danger" role="status" style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
                <svg className="ax-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                <div className="ax-toast__content"><p className="ax-toast__title">Upload failed</p><p className="ax-toast__message">invoice-Q2.pdf could not be processed.</p></div>
                <button type="button" className="ax-toast__action">Retry</button>
              </div>
              <div className="ax-toast ax-toast--accent" role="status" style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
                <svg className="ax-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>
                <div className="ax-toast__content"><p className="ax-toast__title">Invite sent</p><p className="ax-toast__message">mei.lin@northwindlabs.app was invited.</p></div>
                <span className="ax-toast__timer" aria-hidden="true" style={{ transform: 'scaleX(.4)' }} />
              </div>
              <div className="ax-toast" role="status" style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)', flex: '0 0 auto' }}>MR</span>
                <div className="ax-toast__content"><p className="ax-toast__title">Marcus Reyes</p><p className="ax-toast__message">Mentioned you in &ldquo;Design review&rdquo;.</p></div>
                <button type="button" className="ax-toast__action">Reply</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Toasts;
