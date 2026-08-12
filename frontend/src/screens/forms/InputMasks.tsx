'use client';
/*
 * Vireo Next.js — Forms / Input masks (route "forms/input-masks").
 *
 * Faithful re-expression of src/html/forms/input-masks.html: guided entry for phone,
 * EIN, IP, card (with brand detection), expiry/CVC/IBAN, currency/percent/weight,
 * date/time/ZIP — plus a "raw value readout" card showing the unformatted payload.
 * The axMasks() Alpine factory (all mask helpers) is ported verbatim to React state.
 * Classes + ARIA match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const d = (s: string) => (s || '').replace(/\D/g, '');
const maskPhone = (v: string) => { const n = d(v).slice(0, 10); if (n.length < 4) return n; if (n.length < 7) return `(${n.slice(0, 3)}) ${n.slice(3)}`; return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`; };
const maskEin = (v: string) => { const n = d(v).slice(0, 9); return n.length < 3 ? n : `${n.slice(0, 2)}-${n.slice(2)}`; };
const maskIp = (v: string) => v.replace(/[^\d.]/g, '').split('.').slice(0, 4).map((o) => o.slice(0, 3)).join('.');
const maskCard = (v: string) => d(v).slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const maskExp = (v: string) => { const n = d(v).slice(0, 4); return n.length < 3 ? n : `${n.slice(0, 2)} / ${n.slice(2)}`; };
const maskIban = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24).replace(/(.{4})/g, '$1 ').trim();
const maskMoney = (v: string) => { const n = v.replace(/[^\d.]/g, ''); const p = n.split('.'); const i = p[0].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','); return p.length > 1 ? i + '.' + p[1].slice(0, 2) : i; };
const blurMoney = (v: string) => { if (!v) return ''; const n = parseFloat(v.replace(/,/g, '')); return isNaN(n) ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const maskPct = (v: string) => { const n = v.replace(/[^\d.]/g, ''); const p = n.split('.'); const i = p[0].slice(0, 3); return p.length > 1 ? i + '.' + p[1].slice(0, 1) : i; };
const maskDate = (v: string) => { const n = d(v).slice(0, 8); if (n.length < 5) return n; if (n.length < 7) return `${n.slice(0, 4)}-${n.slice(4)}`; return `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6)}`; };
const maskTime = (v: string) => { const n = d(v).slice(0, 4); return n.length < 3 ? n : `${n.slice(0, 2)}:${n.slice(2)}`; };
const maskTime12 = (v: string) => { const up = v.toUpperCase(); const ap = (up.match(/[AP]M?/) || [''])[0]; const n = d(v).slice(0, 4); const t = n.length < 3 ? n : `${n.slice(0, 2)}:${n.slice(2)}`; return ap ? `${t} ${ap.startsWith('P') ? 'PM' : 'AM'}`.trim() : t; };
const maskZip = (v: string) => { const n = d(v).slice(0, 9); return n.length < 6 ? n : `${n.slice(0, 5)}-${n.slice(5)}`; };

export function InputMasks() {
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [phone, setPhone] = useState('(503) 555-0142');
  const [ein, setEin] = useState('82-1739204');
  const [ip, setIp] = useState('192.168.1.24');
  const [card, setCard] = useState('4242 4242 4242 4242');
  const [exp, setExp] = useState('08 / 27');
  const [cvc, setCvc] = useState('123');
  const [iban, setIban] = useState('DE89 3704 0044 0532 0130 00');
  const [amount, setAmount] = useState('1,299.00');
  const [pct, setPct] = useState('12.5');
  const [weight, setWeight] = useState('2.4');
  const [date, setDate] = useState('2026-03-14');
  const [time24, setTime24] = useState('09:30');
  const [time12, setTime12] = useState('02:45 PM');
  const [zip, setZip] = useState('97201-4021');

  const cardBrand = () => { const n = d(card); if (/^4/.test(n)) return 'Visa'; if (/^5[1-5]/.test(n)) return 'Mastercard'; if (/^3[47]/.test(n)) return 'Amex'; if (/^6/.test(n)) return 'Discover'; return '—'; };

  const payload = [
    { k: 'phone', v: () => d(phone) },
    { k: 'card_number', v: () => d(card) },
    { k: 'expiry', v: () => d(exp) },
    { k: 'iban', v: () => iban.replace(/\s/g, '') },
    { k: 'amount', v: () => amount.replace(/,/g, '') },
    { k: 'discount_pct', v: () => pct },
    { k: 'date', v: () => date },
    { k: 'zip', v: () => zip.replace('-', '') },
  ];

  const save = () => { setSaving(true); setTimeout(() => { setSaving(false); setToast(true); setTimeout(() => setToast(false), 2600); }, 600); };

  return (
    <>
      <PageHead
        title="Input masks"
        subtitle="Guided entry for phone, card, currency, dates and identifiers — the mask guide is decorative, raw values submit."
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/forms/validation">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2l4 -4" /><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /></svg>
              <span className="ax-btn__label">Validation</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--primary" onClick={save} aria-busy={saving}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              <span className="ax-btn__label">{saving ? 'Saving…' : 'Submit'}</span>
            </button>
          </>
        }
      />

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60 }}>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', padding: 'var(--ax-space-3) var(--ax-space-4)', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', boxShadow: 'var(--ax-shadow-lg)' }}>
            <span style={{ color: 'var(--ax-viz-emerald)' }}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
            <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Form submitted with masked values</span>
          </div>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="ax-dash-grid">
        {/* CONTACT MASKS */}
        <section className="ax-card ax-col--6" role="region" aria-label="Contact masks">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Contact</span>
              <h2 className="ax-card__title">Phone &amp; identifiers</h2>
              <p className="ax-card__subtitle">Separators are inserted automatically as you type.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="m-phone">Phone number</label>
              <div className="ax-field__control">
                <span className="ax-field__affix ax-field__affix--leading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></span>
                <input id="m-phone" type="tel" inputMode="tel" className="ax-input ax-input--with-leading-icon ax-mono" placeholder="(000) 000-0000" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} autoComplete="tel" maxLength={14} />
              </div>
              <span className="ax-help">US format · <span className="ax-mono">(000) 000-0000</span></span>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="m-ssn">Tax ID</label>
              <input id="m-ssn" type="text" inputMode="numeric" className="ax-input ax-mono" placeholder="00-0000000" value={ein} onChange={(e) => setEin(maskEin(e.target.value))} maxLength={10} />
              <span className="ax-help">EIN · <span className="ax-mono">NN-NNNNNNN</span></span>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="m-ip">Server IP</label>
              <input id="m-ip" type="text" inputMode="decimal" className="ax-input ax-mono" placeholder="000.000.000.000" value={ip} onChange={(e) => setIp(maskIp(e.target.value))} maxLength={15} />
              <span className="ax-help">IPv4 · four octets, dot-separated.</span>
            </div>
          </div>
        </section>

        {/* PAYMENT MASKS */}
        <section className="ax-card ax-col--6" role="region" aria-label="Payment masks">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Payment</span>
              <h2 className="ax-card__title">Card details</h2>
              <p className="ax-card__subtitle">Brand glyph detected from the leading digits.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="m-card">Card number</label>
              <div className="ax-input-group">
                <input id="m-card" type="text" inputMode="numeric" className="ax-input ax-mono" placeholder="0000 0000 0000 0000" value={card} onChange={(e) => setCard(maskCard(e.target.value))} maxLength={19} autoComplete="cc-number" style={{ letterSpacing: '.08em' }} />
                <span className="ax-input-group__addon" aria-hidden="true">
                  <span style={{ fontSize: 'var(--ax-text-2xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: cardBrand() === '—' ? 'var(--ax-text-subtle)' : 'var(--ax-accent)' }}>{cardBrand()}</span>
                </span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
              <div className="ax-field">
                <label className="ax-label" htmlFor="m-exp">Expiry</label>
                <input id="m-exp" type="text" inputMode="numeric" className="ax-input ax-mono" placeholder="MM / YY" value={exp} onChange={(e) => setExp(maskExp(e.target.value))} maxLength={7} autoComplete="cc-exp" />
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="m-cvc">CVC</label>
                <input id="m-cvc" type="text" inputMode="numeric" className="ax-input ax-mono" placeholder="000" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} autoComplete="cc-csc" />
                <span className="ax-help">Never stored or logged.</span>
              </div>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="m-iban">IBAN</label>
              <input id="m-iban" type="text" className="ax-input ax-mono" placeholder="DE00 0000 0000 0000 0000 00" value={iban} onChange={(e) => setIban(maskIban(e.target.value))} maxLength={29} style={{ textTransform: 'uppercase' }} />
              <span className="ax-help">Grouped in fours · letters auto-uppercased.</span>
            </div>
          </div>
        </section>

        {/* NUMBER & MONEY MASKS */}
        <section className="ax-card ax-col--6" role="region" aria-label="Number and currency masks">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Numeric</span>
              <h2 className="ax-card__title">Currency &amp; percent</h2>
              <p className="ax-card__subtitle">Thousands separators and fixed decimals.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="m-amount">Amount</label>
              <div className="ax-input-group">
                <span className="ax-input-group__addon">$</span>
                <input id="m-amount" type="text" inputMode="decimal" className="ax-input ax-mono" placeholder="1,234.56" value={amount} onChange={(e) => setAmount(maskMoney(e.target.value))} onBlur={() => setAmount((a) => blurMoney(a))} style={{ textAlign: 'end' }} />
                <span className="ax-input-group__addon">USD</span>
              </div>
              <span className="ax-help">Two decimals · grouped thousands.</span>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="m-pct">Discount</label>
              <div className="ax-input-group">
                <input id="m-pct" type="text" inputMode="decimal" className="ax-input ax-mono" placeholder="00.0" value={pct} onChange={(e) => setPct(maskPct(e.target.value))} style={{ textAlign: 'end' }} />
                <span className="ax-input-group__addon">%</span>
              </div>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="m-weight">Net weight</label>
              <div className="ax-input-group">
                <input id="m-weight" type="text" inputMode="decimal" className="ax-input ax-mono" placeholder="0.000" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ''))} style={{ textAlign: 'end' }} />
                <span className="ax-input-group__addon">kg</span>
              </div>
            </div>
          </div>
        </section>

        {/* DATE & TIME MASKS */}
        <section className="ax-card ax-col--6" role="region" aria-label="Date and time masks">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Temporal</span>
              <h2 className="ax-card__title">Date &amp; time</h2>
              <p className="ax-card__subtitle">Typeable masks for ISO dates and clock values.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="m-date">Date</label>
              <div className="ax-field__control">
                <span className="ax-field__affix ax-field__affix--leading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg></span>
                <input id="m-date" type="text" inputMode="numeric" className="ax-input ax-input--with-leading-icon ax-mono" placeholder="YYYY-MM-DD" value={date} onChange={(e) => setDate(maskDate(e.target.value))} maxLength={10} />
              </div>
              <span className="ax-help">ISO 8601 · <span className="ax-mono">YYYY-MM-DD</span></span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
              <div className="ax-field">
                <label className="ax-label" htmlFor="m-time24">Time (24h)</label>
                <input id="m-time24" type="text" inputMode="numeric" className="ax-input ax-mono" placeholder="HH:MM" value={time24} onChange={(e) => setTime24(maskTime(e.target.value))} maxLength={5} />
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="m-time12">Time (12h)</label>
                <input id="m-time12" type="text" className="ax-input ax-mono" placeholder="hh:MM AM" value={time12} onChange={(e) => setTime12(maskTime12(e.target.value))} maxLength={8} />
              </div>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="m-zip">ZIP+4</label>
              <input id="m-zip" type="text" inputMode="numeric" className="ax-input ax-mono" placeholder="00000-0000" value={zip} onChange={(e) => setZip(maskZip(e.target.value))} maxLength={10} autoComplete="postal-code" />
            </div>
          </div>
        </section>

        {/* RAW VALUE READOUT */}
        <section className="ax-card ax-col--12" role="region" aria-label="Raw value readout">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Submitted payload</span>
              <h2 className="ax-card__title">What the server receives</h2>
              <p className="ax-card__subtitle">Masks are visual only — the unformatted value is what gets sent.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'var(--ax-space-4)' }}>
              {payload.map((r) => (
                <div key={r.k} style={{ padding: 'var(--ax-space-3) var(--ax-space-4)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
                  <div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)' }}>{r.k}</div>
                  <div className="ax-mono ax-truncate" style={{ marginTop: 4, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{r.v() || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </form>
    </>
  );
}

export default InputMasks;
