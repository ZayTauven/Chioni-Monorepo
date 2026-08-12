/*
 * Vireo Next.js — UI · Progress (route "ui/progress").
 *
 * Faithful re-expression of src/html/ui/progress.html: linear sizes, semantic
 * colours, striped/animated/indeterminate, labeled inline values, stacked
 * multi-segment bars, and two SVG circular rings. Fully static — no browser
 * APIs — so this stays a server component (PageHead is its own client boundary).
 * DOM classes / ARIA / copy match the reference 1:1.
 */
import { PageHead } from '../../components/shell/PageHead';

const ROW_LABEL: React.CSSProperties = { fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' };
const ROW_VAL: React.CSSProperties = { fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' };

function Sized({ label, value, size }: { label: string; value: number; size: string }) {
  return (
    <div>
      <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}><span style={ROW_LABEL}>{label}</span><b className="ax-num" style={ROW_VAL}>{value}%</b></div>
      <div className={`ax-progress ax-progress--${size}`}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${value}%` }} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} progress`} /></div></div>
    </div>
  );
}

export function Progress() {
  return (
    <>
      <PageHead
        title="Progress"
        subtitle="Linear and circular progress — sizes, tones, striped, labeled, stacked and indeterminate."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/spinners">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
              <span className="ax-btn__label">Spinners</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="/charts/sparklines">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19l4 -6l4 2l4 -5l4 4" /></svg>
              <span className="ax-btn__label">Sparklines</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Sizes */}
        <section className="ax-card ax-col--6" role="region" aria-label="Progress sizes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Track height</span>
              <h2 className="ax-card__title">Sizes</h2>
              <p className="ax-card__subtitle">From a 4px hairline to a 12px bar.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <Sized label="Extra small · xs" value={24} size="xs" />
            <Sized label="Small · sm" value={42} size="sm" />
            <Sized label="Medium · md" value={68} size="md" />
            <Sized label="Large · lg" value={86} size="lg" />
          </div>
        </section>

        {/* Colors */}
        <section className="ax-card ax-col--6" role="region" aria-label="Progress colors">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Semantic tones</span>
              <h2 className="ax-card__title">Colors</h2>
              <p className="ax-card__subtitle">Accent by default, plus success, warning and danger.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}><span style={ROW_LABEL}>Accent — Storage used</span><b className="ax-num" style={ROW_VAL}>61%</b></div>
              <div className="ax-progress ax-progress--md"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '61%' }} role="progressbar" aria-valuenow={61} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used" /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}><span style={ROW_LABEL}>Success — Onboarding</span><b className="ax-num" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-success-500)' }}>100%</b></div>
              <div className="ax-progress ax-progress--md ax-progress--success"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '100%' }} role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding complete" /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}><span style={ROW_LABEL}>Warning — Sync backlog</span><b className="ax-num" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-warning-500)' }}>54%</b></div>
              <div className="ax-progress ax-progress--md ax-progress--warning"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '54%' }} role="progressbar" aria-valuenow={54} aria-valuemin={0} aria-valuemax={100} aria-label="Sync backlog" /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}><span style={ROW_LABEL}>Danger — Error budget</span><b className="ax-num" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-danger-500)' }}>19%</b></div>
              <div className="ax-progress ax-progress--md ax-progress--danger"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '19%' }} role="progressbar" aria-valuenow={19} aria-valuemin={0} aria-valuemax={100} aria-label="Error budget remaining" /></div></div>
            </div>
          </div>
        </section>

        {/* Striped & animated */}
        <section className="ax-card ax-col--6" role="region" aria-label="Striped and animated progress">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Texture</span>
              <h2 className="ax-card__title">Striped &amp; Animated</h2>
              <p className="ax-card__subtitle">A diagonal weave, optionally marching to signal active work.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}><span style={ROW_LABEL}>Striped</span><b className="ax-num" style={ROW_VAL}>72%</b></div>
              <div className="ax-progress ax-progress--lg ax-progress--striped"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '72%' }} role="progressbar" aria-valuenow={72} aria-valuemin={0} aria-valuemax={100} aria-label="Striped progress" /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}><span style={ROW_LABEL}>Striped + animated — Importing</span><b className="ax-num" style={ROW_VAL}>47%</b></div>
              <div className="ax-progress ax-progress--lg ax-progress--striped ax-progress--animated"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '47%' }} role="progressbar" aria-valuenow={47} aria-valuemin={0} aria-valuemax={100} aria-label="Import progress" /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}><span style={ROW_LABEL}>Indeterminate — Connecting</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>no fixed length</span></div>
              <div className="ax-progress ax-progress--lg ax-progress--indeterminate"><div className="ax-progress__track"><div className="ax-progress__fill" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-label="Connecting" /></div></div>
            </div>
          </div>
        </section>

        {/* Labeled */}
        <section className="ax-card ax-col--6" role="region" aria-label="Labeled progress">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Inline value</span>
              <h2 className="ax-card__title">Labeled</h2>
              <p className="ax-card__subtitle">The bar and its mono value share one row via __value.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div>
              <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginBottom: 'var(--ax-space-2)' }}>CPU</div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '38%' }} role="progressbar" aria-valuenow={38} aria-valuemin={0} aria-valuemax={100} aria-label="CPU" /></div><span className="ax-progress__value ax-num">38%</span></div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginBottom: 'var(--ax-space-2)' }}>Memory</div>
              <div className="ax-progress ax-progress--sm ax-progress--warning"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '73%' }} role="progressbar" aria-valuenow={73} aria-valuemin={0} aria-valuemax={100} aria-label="Memory" /></div><span className="ax-progress__value ax-num">73%</span></div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginBottom: 'var(--ax-space-2)' }}>Disk</div>
              <div className="ax-progress ax-progress--sm ax-progress--danger"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '91%' }} role="progressbar" aria-valuenow={91} aria-valuemin={0} aria-valuemax={100} aria-label="Disk" /></div><span className="ax-progress__value ax-num">91%</span></div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginBottom: 'var(--ax-space-2)' }}>Bandwidth</div>
              <div className="ax-progress ax-progress--sm ax-progress--success"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '22%' }} role="progressbar" aria-valuenow={22} aria-valuemin={0} aria-valuemax={100} aria-label="Bandwidth" /></div><span className="ax-progress__value ax-num">22%</span></div>
            </div>
          </div>
        </section>

        {/* Stacked */}
        <section className="ax-card ax-col--8" role="region" aria-label="Stacked progress">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Breakdown</span>
              <h2 className="ax-card__title">Stacked</h2>
              <p className="ax-card__subtitle">Several segments share one track to show composition.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-7)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}><span style={ROW_LABEL}>Storage by type</span><b className="ax-num" style={ROW_VAL}>412 GB / 500 GB</b></div>
              <div className="ax-progress ax-progress--lg ax-progress--stacked">
                <div className="ax-progress__track">
                  <div className="ax-progress__fill" style={{ width: '38%', background: 'var(--ax-viz-cyan)' }} role="progressbar" aria-valuenow={38} aria-valuemin={0} aria-valuemax={100} aria-label="Images 38 percent" />
                  <div className="ax-progress__fill" style={{ width: '24%', background: 'var(--ax-viz-violet)' }} role="progressbar" aria-valuenow={24} aria-valuemin={0} aria-valuemax={100} aria-label="Video 24 percent" />
                  <div className="ax-progress__fill" style={{ width: '14%', background: 'var(--ax-viz-amber)' }} role="progressbar" aria-valuenow={14} aria-valuemin={0} aria-valuemax={100} aria-label="Documents 14 percent" />
                  <div className="ax-progress__fill" style={{ width: '6%', background: 'var(--ax-viz-pink)' }} role="progressbar" aria-valuenow={6} aria-valuemin={0} aria-valuemax={100} aria-label="Other 6 percent" />
                </div>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginTop: 'var(--ax-space-3)' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Images <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>190 GB</b></small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-violet)' }} /><small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Video <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>120 GB</b></small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-amber)' }} /><small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Docs <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>70 GB</b></small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-pink)' }} /><small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Other <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>32 GB</b></small></span>
              </div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}><span style={ROW_LABEL}>Deal pipeline</span><b className="ax-num" style={ROW_VAL}>$284K</b></div>
              <div className="ax-progress ax-progress--md ax-progress--stacked">
                <div className="ax-progress__track">
                  <div className="ax-progress__fill" style={{ width: '30%', background: 'var(--ax-accent)' }} role="progressbar" aria-valuenow={30} aria-valuemin={0} aria-valuemax={100} aria-label="Qualified" />
                  <div className="ax-progress__fill" style={{ width: '26%', background: 'var(--ax-viz-cyan)' }} role="progressbar" aria-valuenow={26} aria-valuemin={0} aria-valuemax={100} aria-label="Proposal" />
                  <div className="ax-progress__fill" style={{ width: '21%', background: 'var(--ax-viz-emerald)' }} role="progressbar" aria-valuenow={21} aria-valuemin={0} aria-valuemax={100} aria-label="Won" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Circular */}
        <section className="ax-card ax-col--4" role="region" aria-label="Circular progress">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Radial</span>
              <h2 className="ax-card__title">Circular</h2>
              <p className="ax-card__subtitle">Ring track + value center.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-5)' }}>
            <div className="ax-progress ax-progress--circle" style={{ width: 96, height: 96 }} role="progressbar" aria-valuenow={76} aria-valuemin={0} aria-valuemax={100} aria-label="Sprint completion 76 percent">
              <svg viewBox="0 0 80 80" width={96} height={96} aria-hidden="true">
                <circle className="ax-progress__ring-track" cx={40} cy={40} r={32} strokeWidth={7} />
                <circle className="ax-progress__ring-fill" cx={40} cy={40} r={32} strokeWidth={7} strokeDasharray="201.06" strokeDashoffset="48.25" transform="rotate(-90 40 40)" />
              </svg>
              <div className="ax-progress__center" style={{ flexDirection: 'column', lineHeight: 1 }}>
                <b style={{ fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>76%</b>
                <small style={{ fontFamily: 'var(--ax-font-sans)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Sprint</small>
              </div>
            </div>
            <div className="ax-progress ax-progress--circle" style={{ width: 96, height: 96 }} role="progressbar" aria-valuenow={92} aria-valuemin={0} aria-valuemax={100} aria-label="Uptime 92 percent">
              <svg viewBox="0 0 80 80" width={96} height={96} aria-hidden="true">
                <circle className="ax-progress__ring-track" cx={40} cy={40} r={32} strokeWidth={7} />
                <circle className="ax-progress__ring-fill" cx={40} cy={40} r={32} strokeWidth={7} strokeDasharray="201.06" strokeDashoffset="16.08" transform="rotate(-90 40 40)" style={{ stroke: 'var(--ax-success-500)' }} />
              </svg>
              <div className="ax-progress__center" style={{ flexDirection: 'column', lineHeight: 1 }}>
                <b style={{ fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>92%</b>
                <small style={{ fontFamily: 'var(--ax-font-sans)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>SLA</small>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Progress;
