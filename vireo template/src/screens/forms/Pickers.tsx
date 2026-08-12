'use client';
/*
 * Vireo Next.js — Forms / Pickers (route "forms/pickers").
 *
 * Faithful re-expression of src/html/forms/pickers.html: a single date picker with a
 * month-grid popover, a date-range picker with a preset rail + accent-wash range, a
 * 12-hour time picker, a combined datetime/month/week field, and a swatch + hex color
 * picker. Each Alpine x-data island is ported to a small React island (useClickOutside
 * for outside/Escape close). Classes, inline styling & ARIA match the reference 1:1.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';
import { useClickOutside } from '../../hooks/useClickOutside';

const CalIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /></svg>
);

const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);
const LEAD = [28, 29, 30, 31];
const TRAIL = [1, 2, 3, 4, 5];

function DatePicker() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(14);
  const [label, setLabel] = useState('Jun 14, 2026');
  const today = 9;
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));
  const pick = (d: number) => { setSelected(d); setLabel('Jun ' + d + ', 2026'); setOpen(false); };

  return (
    <section className="ax-card ax-col--6" role="region" aria-label="Date picker">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Date</span>
          <h2 className="ax-card__title">Single Date</h2>
          <p className="ax-card__subtitle">Typeable trigger + month grid popover.</p>
        </div>
      </div>
      <div className="ax-card__body">
        <div className="ax-field" style={{ position: 'relative' }} ref={ref}>
          <label className="ax-label" htmlFor="pk-date">Due date</label>
          <div className="ax-field__control">
            <input id="pk-date" type="text" className="ax-input ax-input--with-trailing ax-num" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="MMM D, YYYY" style={{ fontFamily: 'var(--ax-font-mono)' }} onFocus={() => setOpen(true)} />
            <button type="button" className="ax-field__affix ax-field__affix--trailing ax-field__affix--button" onClick={() => setOpen((o) => !o)} aria-label="Open calendar">{CalIcon}</button>
          </div>
          {open && (
            <div role="dialog" aria-label="Choose date"
              style={{ position: 'absolute', zIndex: 'var(--ax-z-dropdown,40)' as unknown as number, top: '100%', insetInlineStart: 0, marginTop: 'var(--ax-space-2)', width: 300, padding: 'var(--ax-space-4)', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', boxShadow: 'var(--ax-shadow-md)', backdropFilter: 'blur(18px) saturate(1.1)' }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Previous month"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                <b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>June 2026</b>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Next month"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </div>
              <div role="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, textAlign: 'center' }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <span key={d} style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', padding: 'var(--ax-space-1) 0' }}>{d}</span>)}
                {LEAD.map((d) => <span key={'l' + d} className="ax-num" style={{ padding: 'var(--ax-space-2) 0', color: 'var(--ax-text-disabled)', fontSize: 'var(--ax-text-xs)' }}>{d}</span>)}
                {DAYS.map((d) => {
                  const base: React.CSSProperties = { padding: 'var(--ax-space-2) 0', borderRadius: 'var(--ax-radius-sm)', fontSize: 'var(--ax-text-xs)', cursor: 'pointer' };
                  const style: React.CSSProperties = selected === d
                    ? { ...base, border: 0, background: 'var(--ax-accent)', color: 'var(--ax-on-accent)', fontWeight: 600 }
                    : today === d
                      ? { ...base, border: '1px solid var(--ax-accent)', background: 'transparent', color: 'var(--ax-text)' }
                      : { ...base, border: 0, background: 'transparent', color: 'var(--ax-text)' };
                  return <button key={d} type="button" className="ax-num" onClick={() => pick(d)} aria-pressed={selected === d} style={style}>{d}</button>;
                })}
                {TRAIL.map((d) => <span key={'t' + d} className="ax-num" style={{ padding: 'var(--ax-space-2) 0', color: 'var(--ax-text-disabled)', fontSize: 'var(--ax-text-xs)' }}>{d}</span>)}
              </div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-3)', paddingTop: 'var(--ax-space-3)', borderTop: '1px solid var(--ax-border)' }}>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => { setSelected(today); setLabel('Jun 9, 2026'); setOpen(false); }}><span className="ax-btn__label">Today</span></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => { setLabel(''); setOpen(false); }}><span className="ax-btn__label">Clear</span></button>
              </div>
            </div>
          )}
          <span className="ax-help">Today is highlighted with an accent ring.</span>
        </div>
      </div>
    </section>
  );
}

const PRESETS = [
  { id: 'today', name: 'Today', label: 'Jun 28, 2026' },
  { id: 'last7', name: 'Last 7 days', label: 'Jun 22 – 28, 2026' },
  { id: 'last30', name: 'Last 30 days', label: 'May 30 – Jun 28, 2026' },
  { id: 'month', name: 'This month', label: 'Jun 1 – 28, 2026' },
  { id: 'quarter', name: 'This quarter', label: 'Apr 1 – Jun 28, 2026' },
];

function RangePicker() {
  const [preset, setPreset] = useState('last30');
  const [label, setLabel] = useState('May 30 – Jun 28, 2026');
  const presetStyle = (active: boolean): React.CSSProperties => ({
    textAlign: 'start', padding: 'var(--ax-space-2) var(--ax-space-3)', border: 0, borderRadius: 'var(--ax-radius-sm)', cursor: 'pointer', fontSize: 'var(--ax-text-xs)',
    ...(active ? { background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', fontWeight: 600 } : { background: 'transparent', color: 'var(--ax-text-muted)' }),
  });

  return (
    <section className="ax-card ax-col--6" role="region" aria-label="Date range picker">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Date</span>
          <h2 className="ax-card__title">Date Range</h2>
          <p className="ax-card__subtitle">Preset rail + range with accent-wash between endpoints.</p>
        </div>
      </div>
      <div className="ax-card__body">
        <div className="ax-field" style={{ marginBottom: 'var(--ax-space-4)' }}>
          <label className="ax-label" htmlFor="pk-range">Reporting period</label>
          <div className="ax-field__control">
            <span className="ax-field__affix ax-field__affix--leading" aria-hidden="true">{CalIcon}</span>
            <input id="pk-range" type="text" className="ax-input ax-input--with-leading-icon ax-num" value={label} readOnly style={{ fontFamily: 'var(--ax-font-mono)' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 'var(--ax-space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderInlineEnd: '1px solid var(--ax-border)', paddingInlineEnd: 'var(--ax-space-3)' }}>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="ax-num" onClick={() => { setPreset(p.id); setLabel(p.label); }} style={presetStyle(preset === p.id)}>{p.name}</button>
            ))}
          </div>
          <div role="grid" aria-label="June 2026">
            <div className="ax-cluster" style={{ justifyContent: 'center', marginBottom: 'var(--ax-space-2)' }}><b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-strong)' }}>June 2026</b></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, textAlign: 'center' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} style={{ fontSize: 9, color: 'var(--ax-text-subtle)' }}>{d}</span>)}
              {DAYS.map((d) => {
                let style: React.CSSProperties = { padding: '5px 0', fontSize: 10, color: 'var(--ax-text-muted)' };
                if (d === 22) style = { padding: '5px 0', fontSize: 10, background: 'var(--ax-accent)', color: 'var(--ax-on-accent)', borderRadius: 'var(--ax-radius-sm) 0 0 var(--ax-radius-sm)', fontWeight: 600 };
                else if (d === 28) style = { padding: '5px 0', fontSize: 10, background: 'var(--ax-accent)', color: 'var(--ax-on-accent)', borderRadius: '0 var(--ax-radius-sm) var(--ax-radius-sm) 0', fontWeight: 600 };
                else if (d > 22 && d < 28) style = { padding: '5px 0', fontSize: 10, background: 'var(--ax-accent-wash)', color: 'var(--ax-text)' };
                return <span key={d} className="ax-num" style={style}>{d}</span>;
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimePicker() {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('30');
  const [mer, setMer] = useState('AM');
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));
  const label = `${hour}:${minute} ${mer}`;

  return (
    <section className="ax-card ax-col--4" role="region" aria-label="Time picker">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Time</span>
          <h2 className="ax-card__title">Time</h2>
          <p className="ax-card__subtitle">12-hour with meridiem toggle.</p>
        </div>
      </div>
      <div className="ax-card__body">
        <div className="ax-field" style={{ position: 'relative' }} ref={ref}>
          <label className="ax-label" htmlFor="pk-time">Start time</label>
          <div className="ax-field__control">
            <input id="pk-time" type="text" className="ax-input ax-input--with-trailing ax-num" value={label} readOnly style={{ fontFamily: 'var(--ax-font-mono)' }} />
            <button type="button" className="ax-field__affix ax-field__affix--trailing ax-field__affix--button" onClick={() => setOpen((o) => !o)} aria-label="Open time picker">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 7v5l3 3" /></svg>
            </button>
          </div>
          {open && (
            <div role="dialog" aria-label="Choose time"
              style={{ position: 'absolute', zIndex: 'var(--ax-z-dropdown,40)' as unknown as number, top: '100%', insetInlineStart: 0, marginTop: 'var(--ax-space-2)', padding: 'var(--ax-space-3)', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', boxShadow: 'var(--ax-shadow-md)', display: 'flex', gap: 'var(--ax-space-2)' }}>
              <select className="ax-select ax-select--sm ax-num" value={hour} onChange={(e) => setHour(e.target.value)} aria-label="Hour" style={{ fontFamily: 'var(--ax-font-mono)' }}>{['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((h) => <option key={h} value={h}>{h}</option>)}</select>
              <span style={{ alignSelf: 'center', color: 'var(--ax-text-subtle)' }}>:</span>
              <select className="ax-select ax-select--sm ax-num" value={minute} onChange={(e) => setMinute(e.target.value)} aria-label="Minute" style={{ fontFamily: 'var(--ax-font-mono)' }}>{['00', '15', '30', '45'].map((m) => <option key={m} value={m}>{m}</option>)}</select>
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="AM or PM">
                <button type="button" className={`ax-btn ax-btn--sm ${mer === 'AM' ? 'is-selected' : ''}`.trim()} aria-checked={mer === 'AM'} role="radio" onClick={() => setMer('AM')}>AM</button>
                <button type="button" className={`ax-btn ax-btn--sm ${mer === 'PM' ? 'is-selected' : ''}`.trim()} aria-checked={mer === 'PM'} role="radio" onClick={() => setMer('PM')}>PM</button>
              </div>
            </div>
          )}
          <span className="ax-help">Snaps to 15-minute increments.</span>
        </div>
      </div>
    </section>
  );
}

function DatetimeCard() {
  return (
    <section className="ax-card ax-col--4" role="region" aria-label="Date and time">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Date + Time</span>
          <h2 className="ax-card__title">Datetime</h2>
          <p className="ax-card__subtitle">One combined field.</p>
        </div>
      </div>
      <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pk-dt">Scheduled publish</label>
          <div className="ax-field__control">
            <span className="ax-field__affix ax-field__affix--leading" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M11.795 21h-6.795a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4" /><path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M15 3v4" /><path d="M7 3v4" /><path d="M3 11h16" /><path d="M18 16.5v1.5l.5 .5" /></svg></span>
            <input id="pk-dt" type="text" className="ax-input ax-input--with-leading-icon ax-num" defaultValue="Jun 14, 2026 · 09:30 AM" readOnly style={{ fontFamily: 'var(--ax-font-mono)' }} />
          </div>
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pk-month">Month / Year</label>
          <input id="pk-month" type="text" className="ax-input ax-num" defaultValue="Jun 2026" readOnly style={{ fontFamily: 'var(--ax-font-mono)' }} />
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pk-week">ISO Week</label>
          <input id="pk-week" type="text" className="ax-input ax-num" defaultValue="2026-W24" readOnly style={{ fontFamily: 'var(--ax-font-mono)' }} />
        </div>
      </div>
    </section>
  );
}

const SWATCHES = ['#39A185', '#5883DD', '#807AD8', '#A56EC7', '#CD5E9A', '#CD674F', '#E0A53A', '#84A725', '#36965C', '#15A4B7', '#72879D', '#86857D'];

function ColorPicker() {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState('#39A185');
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));

  return (
    <section className="ax-card ax-col--4" role="region" aria-label="Color picker">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Color</span>
          <h2 className="ax-card__title">Color</h2>
          <p className="ax-card__subtitle">Swatch + hex with a saturation popover.</p>
        </div>
      </div>
      <div className="ax-card__body">
        <div className="ax-field" style={{ position: 'relative' }} ref={ref}>
          <label className="ax-label" htmlFor="pk-color">Brand color</label>
          <button type="button" className="ax-combobox__trigger" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Open color picker" style={{ gap: 'var(--ax-space-3)' }}>
            <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 'var(--ax-radius-sm)', border: '1px solid var(--ax-border-strong)', background: hex }} />
            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', flex: 1, textAlign: 'start' }}>{hex.toUpperCase()}</span>
            <svg className="ax-combobox__caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
          </button>
          {open && (
            <div role="dialog" aria-label="Pick a color"
              style={{ position: 'absolute', zIndex: 'var(--ax-z-dropdown,40)' as unknown as number, top: '100%', insetInlineStart: 0, marginTop: 'var(--ax-space-2)', width: 240, padding: 'var(--ax-space-3)', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', boxShadow: 'var(--ax-shadow-md)' }}>
              <div aria-hidden="true" style={{ height: 120, borderRadius: 'var(--ax-radius-sm)', marginBottom: 'var(--ax-space-3)', position: 'relative', background: `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,${hex})` }}>
                <span style={{ position: 'absolute', top: 14, right: 22, width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,.4)' }} />
              </div>
              <input type="range" min={0} max={360} defaultValue={160} className="ax-range--native" aria-label="Hue" style={{ width: '100%', height: 10, borderRadius: 'var(--ax-radius-pill)', marginBottom: 'var(--ax-space-3)', background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }} />
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginBottom: 'var(--ax-space-3)' }}>
                <div className="ax-input-group" style={{ flex: 1 }}>
                  <span className="ax-input-group__addon">HEX</span>
                  <input type="text" className="ax-input ax-num" value={hex} onChange={(e) => setHex(e.target.value)} maxLength={7} style={{ fontFamily: 'var(--ax-font-mono)', textTransform: 'uppercase' }} />
                </div>
              </div>
              <div role="radiogroup" aria-label="Preset colors" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 'var(--ax-space-2)' }}>
                {SWATCHES.map((c) => {
                  const sel = hex.toUpperCase() === c.toUpperCase();
                  return (
                    <button key={c} type="button" role="radio" aria-checked={sel} onClick={() => setHex(c)} aria-label={c}
                      style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--ax-radius-sm)', cursor: 'pointer', background: c, border: sel ? '2px solid var(--ax-text-strong)' : '1px solid var(--ax-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {sel && <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <span className="ax-help">Preset swatches mirror the 12 Aurora accents.</span>
        </div>
      </div>
    </section>
  );
}

export function Pickers() {
  return (
    <>
      <PageHead
        title="Pickers"
        subtitle="Date, range, time &amp; color pickers — masked triggers with glassy popovers."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/forms/elements">
            {CalIcon}
            <span className="ax-btn__label">All elements</span>
          </Link>
        }
      />
      <div className="ax-dash-grid">
        <DatePicker />
        <RangePicker />
        <TimePicker />
        <DatetimeCard />
        <ColorPicker />
      </div>
    </>
  );
}

export default Pickers;
