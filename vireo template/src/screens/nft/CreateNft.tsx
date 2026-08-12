'use client';
/*
 * Vireo Next.js — NFT · Create.
 * Faithful re-expression of src/html/nft/create-nft.html: a four-step minting
 * form (upload dropzone w/ preview, details, dynamic traits, pricing & supply)
 * plus a sticky right rail with a live card preview, cost summary, and mint
 * actions (terms gate, mint result alert, save-draft). The Alpine axCreateNft()
 * store is rebuilt as React state. Classes / ARIA match the reference 1:1.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const SALE_TYPES = [
  { id: 'fixed', name: 'Fixed price', desc: 'Sell at a set price', icon: <><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></> },
  { id: 'auction', name: 'Auction', desc: 'Highest bid wins', icon: <><path d="M13 10l7.383 7.418c.823 .82 .823 2.148 0 2.967a2.11 2.11 0 0 1 -2.976 0l-7.407 -7.385" /><path d="M6 9l4 4" /><path d="M13 10l-4 -4" /><path d="M3 21h7" /></> },
  { id: 'open', name: 'Open offers', desc: 'Accept any offer', icon: <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></> },
];

const COLLECTION_LABELS: Record<string, string> = { 'quiet-forms': 'Quiet Forms', 'quiet-surface': 'Quiet Surface', 'aurora-genesis': 'Aurora Genesis', __new: 'New collection' };

interface Trait { id: number; k: string; v: string; }

export function CreateNft() {
  const [dragover, setDragover] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [agree, setAgree] = useState(false);
  const [minted, setMinted] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [collection, setCollection] = useState('');
  const [chain, setChain] = useState('eth');
  const [traits, setTraits] = useState<Trait[]>([{ id: 1, k: 'Background', v: 'Bone' }, { id: 2, k: 'Palette', v: 'Verdigris' }]);
  const [sale, setSale] = useState('fixed');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('24');
  const [supply, setSupply] = useState('1');
  const [royalty, setRoyalty] = useState('5');
  const idRef = useRef(2);

  const num = (v: string) => { const n = parseFloat(v.replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; };
  const priceUsd = () => { const p = num(price); return p ? '$' + (p * 2380).toLocaleString('en-US', { maximumFractionDigits: 0 }) : ''; };
  const collectionLabel = () => COLLECTION_LABELS[collection] || 'Collection';
  const marketFee = () => (num(price) * 0.025).toFixed(4) + ' ETH';
  const netReceive = () => { const p = num(price); const net = p - p * 0.025; return net > 0 ? net.toFixed(4) + ' ETH' : '—'; };
  const canMint = () => uploaded && name.trim() !== '' && collection !== '' && collection !== '__new' && agree;

  const addTrait = () => { idRef.current += 1; setTraits((t) => [...t, { id: idRef.current + 10, k: '', v: '' }]); };
  const removeTrait = (i: number) => setTraits((t) => t.filter((_, idx) => idx !== i));
  const setTrait = (i: number, key: 'k' | 'v', val: string) => setTraits((t) => t.map((x, idx) => (idx === i ? { ...x, [key]: val } : x)));

  const mint = () => { if (!canMint()) return; setMinted(true); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => setMinted(false), 5000); };
  const saveDraft = () => { setDraftSaved(true); setTimeout(() => setDraftSaved(false), 3000); };

  return (
    <form onSubmit={(e) => { e.preventDefault(); mint(); }}>
      <PageHead
        title="Create NFT"
        subtitle="Upload your artwork, set the details, and mint it to the marketplace."
        actions={
          <Link className="ax-btn ax-btn--ghost" href="/nft/marketplace">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
            <span className="ax-btn__label">Cancel</span>
          </Link>
        }
      />

      {minted && (
        <div className="ax-alert ax-alert--success" role="status" style={{ marginBottom: 'var(--ax-space-6)' }}>
          <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
          <div className="ax-alert__content"><p className="ax-alert__title">Item minted</p><p className="ax-alert__message"><b className="ax-num">{name || 'Your item'}</b> is now live on the marketplace. Transaction <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>0x4e91…a07c</span> confirmed.</p></div>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setMinted(false)} aria-label="Dismiss"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
        </div>
      )}

      <div className="ax-dash-grid" style={{ alignItems: 'start' }}>
        {/* LEFT */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* UPLOAD */}
          <section className="ax-card" role="region" aria-label="Upload artwork">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Step 1</span>
                <h2 className="ax-card__title">Upload artwork</h2>
                <p className="ax-card__subtitle">This is the file minted on-chain. It can&apos;t be changed later.</p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              {!uploaded && (
                <div className={`ax-dropzone${dragover ? ' is-dragover' : ''}`}>
                  <label className="ax-dropzone__area" htmlFor="nft-file" onDragOver={(e) => { e.preventDefault(); setDragover(true); }} onDragLeave={() => setDragover(false)} onDrop={(e) => { e.preventDefault(); setDragover(false); setUploaded(true); }} style={{ cursor: 'pointer' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /><path d="M9 15l3 -3l3 3" /><path d="M12 12l0 9" /></svg>
                    <div><b style={{ color: 'var(--ax-text)' }}>Click to upload</b> or drag &amp; drop</div>
                    <small style={{ color: 'var(--ax-text-subtle)' }}>PNG, JPG, GIF, SVG, MP4 or GLB up to 100 MB</small>
                    <input id="nft-file" type="file" accept="image/*,video/mp4,.glb" className="ax-visually-hidden" onChange={() => setUploaded(true)} />
                  </label>
                </div>
              )}
              {uploaded && (
                <div className="ax-flex" style={{ flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                  <div style={{ position: 'relative', aspectRatio: '1/1', maxWidth: 380, borderRadius: 'var(--ax-radius-lg)', overflow: 'hidden', border: '1px solid var(--ax-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, color-mix(in oklab,var(--ax-viz-violet) 76%,var(--ax-surface-solid)), color-mix(in oklab,var(--ax-viz-cyan) 56%,var(--ax-surface-solid)))' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 64, height: 64 }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
                    <button type="button" className="ax-btn ax-btn--icon ax-btn--sm" onClick={() => setUploaded(false)} aria-label="Remove artwork" style={{ position: 'absolute', top: 8, insetInlineEnd: 8, background: 'rgba(8,10,15,.5)', color: '#fff', border: 0, borderRadius: 'var(--ax-radius-sm)', backdropFilter: 'blur(6px)' }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
                  </div>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--ax-viz-emerald)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16 }}><path d="M5 12l5 5l10 -10" /></svg>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>quiet-forms-145.png</span> · <span className="ax-num">2.8 MB</span> · 2400×2400
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* DETAILS */}
          <section className="ax-card" role="region" aria-label="Item details">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Step 2</span>
                <h2 className="ax-card__title">Details</h2>
                <p className="ax-card__subtitle">Give your item a name and tell collectors about it.</p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div className="ax-field">
                <label className="ax-label" htmlFor="nft-name">Name <span className="ax-field__required">*</span></label>
                <input id="nft-name" type="text" className="ax-input" placeholder="e.g. Quiet Forms #145" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="nft-desc">Description</label>
                <textarea id="nft-desc" className="ax-textarea" rows={4} placeholder="Describe the concept, edition, and what holders get." value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={600} />
                <span className="ax-help"><span className="ax-num">{desc.length}</span> / 600 characters · Markdown supported.</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field" style={{ gridColumn: 'span 6', margin: 0 }}>
                  <label className="ax-label" htmlFor="nft-collection">Collection <span className="ax-field__required">*</span></label>
                  <select id="nft-collection" className="ax-select" value={collection} onChange={(e) => setCollection(e.target.value)}>
                    <option value="">Select a collection</option>
                    <option value="quiet-forms">Quiet Forms</option>
                    <option value="quiet-surface">Quiet Surface</option>
                    <option value="aurora-genesis">Aurora Genesis</option>
                    <option value="__new">+ Create new collection</option>
                  </select>
                  {collection === '__new' && <span className="ax-help">You&apos;ll set the collection name &amp; logo on the next step.</span>}
                </div>
                <div className="ax-field" style={{ gridColumn: 'span 6', margin: 0 }}>
                  <label className="ax-label" htmlFor="nft-chain">Blockchain</label>
                  <select id="nft-chain" className="ax-select" value={chain} onChange={(e) => setChain(e.target.value)}>
                    <option value="eth">Ethereum</option>
                    <option value="poly">Polygon</option>
                    <option value="sol">Solana</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* PROPERTIES */}
          <section className="ax-card" role="region" aria-label="Properties">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Step 3</span>
                <h2 className="ax-card__title">Properties</h2>
                <p className="ax-card__subtitle">Traits shown as chips on the item. They power rarity &amp; filters.</p>
              </div>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={addTrait}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                <span className="ax-btn__label">Add trait</span>
              </button>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              {traits.map((t, i) => (
                <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 'var(--ax-space-3)', alignItems: 'start' }}>
                  <input type="text" className="ax-input" placeholder="Type (e.g. Background)" value={t.k} onChange={(e) => setTrait(i, 'k', e.target.value)} aria-label={'Trait ' + (i + 1) + ' name'} />
                  <input type="text" className="ax-input" placeholder="Value (e.g. Bone)" value={t.v} onChange={(e) => setTrait(i, 'v', e.target.value)} aria-label={'Trait ' + (i + 1) + ' value'} />
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => removeTrait(i)} aria-label={'Remove trait ' + (i + 1)}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>
                </div>
              ))}
              {traits.length === 0 && <div style={{ textAlign: 'center', padding: 'var(--ax-space-5) 0', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>No traits yet. Add one to describe this item&apos;s attributes.</div>}
            </div>
          </section>

          {/* PRICING / SALE */}
          <section className="ax-card" role="region" aria-label="Pricing and supply">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Step 4</span>
                <h2 className="ax-card__title">Pricing &amp; supply</h2>
                <p className="ax-card__subtitle">Choose how this item sells and how many exist.</p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div>
                <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Sale type</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)' }}>
                  {SALE_TYPES.map((s) => (
                    <label key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3)', borderWidth: 1.5, borderStyle: 'solid', transition: 'border-color var(--ax-motion-fast) var(--ax-ease-standard)', ...(sale === s.id ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : { borderColor: 'var(--ax-border)', background: 'var(--ax-surface)' }) }}>
                      <span className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18, color: sale === s.id ? 'var(--ax-accent)' : 'var(--ax-text-subtle)' }}>{s.icon}</svg>
                        <input type="radio" name="nft-sale" className="ax-radio" value={s.id} checked={sale === s.id} onChange={() => setSale(s.id)} />
                      </span>
                      <span style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{s.name}</span>
                      <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{s.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
              {sale !== 'open' && (
                <div className="ax-grid" style={{ gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field" style={{ gridColumn: 'span 6', margin: 0 }}>
                    <label className="ax-label" htmlFor="nft-price">{sale === 'auction' ? 'Starting bid' : 'Price'}</label>
                    <div className="ax-input-group">
                      <input id="nft-price" type="text" className="ax-input ax-num" inputMode="decimal" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} />
                      <span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)' }}>ETH</span>
                    </div>
                    {priceUsd() && <span className="ax-help">≈ <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{priceUsd()}</span> at current rate</span>}
                  </div>
                  {sale === 'auction' && (
                    <div className="ax-field" style={{ gridColumn: 'span 6', margin: 0 }}>
                      <label className="ax-label" htmlFor="nft-duration">Auction duration</label>
                      <select id="nft-duration" className="ax-select" value={duration} onChange={(e) => setDuration(e.target.value)}>
                        <option value="12">12 hours</option>
                        <option value="24">1 day</option>
                        <option value="72">3 days</option>
                        <option value="168">7 days</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field" style={{ gridColumn: 'span 6', margin: 0 }}>
                  <label className="ax-label" htmlFor="nft-supply">Supply</label>
                  <input id="nft-supply" type="text" className="ax-input ax-num" inputMode="numeric" placeholder="1" value={supply} onChange={(e) => setSupply(e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} />
                  <span className="ax-help">Number of copies to mint (ERC-1155 for &gt; 1).</span>
                </div>
                <div className="ax-field" style={{ gridColumn: 'span 6', margin: 0 }}>
                  <label className="ax-label" htmlFor="nft-royalty">Creator royalty</label>
                  <div className="ax-input-group">
                    <input id="nft-royalty" type="text" className="ax-input ax-num" inputMode="decimal" placeholder="5" value={royalty} onChange={(e) => setRoyalty(e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} />
                    <span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)' }}>%</span>
                  </div>
                  <span className="ax-help">Earned on every future resale. Max 15%.</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT RAIL */}
        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', position: 'sticky', top: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="Live preview">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Preview</h2><p className="ax-card__subtitle">How your card appears in the market.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <article className="ax-card" style={{ margin: 0, overflow: 'hidden', maxWidth: 260 }}>
                <div style={{ aspectRatio: '1/1', background: 'linear-gradient(135deg, color-mix(in oklab,var(--ax-viz-violet) 76%,var(--ax-surface-solid)), color-mix(in oklab,var(--ax-viz-cyan) 56%,var(--ax-surface-solid)))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 44, height: 44 }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /></svg>
                </div>
                <div className="ax-card__body" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{collectionLabel()}</div>
                  <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{name || 'Untitled item'}</div>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', paddingTop: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)' }}>
                    <span style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)' }}>{sale === 'auction' ? 'Starting bid' : 'Price'}</span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{(parseFloat(price) || 0).toFixed(2)} ETH</span>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Fees and cost">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Cost summary</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ul className="ax-list ax-list--compact">
                <li className="ax-list__row" style={{ paddingInline: 0 }}><span className="ax-list__content"><span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Network (gas) fee</span></span><span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>0.0042 ETH</span></li>
                <li className="ax-list__row" style={{ paddingInline: 0 }}><span className="ax-list__content"><span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Marketplace fee (2.5%)</span></span><span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{marketFee()}</span></li>
                <li className="ax-list__row" style={{ paddingInline: 0 }}><span className="ax-list__content"><span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Creator royalty</span></span><span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{(num(royalty)) + '%'}</span></li>
                <li className="ax-list__row" style={{ paddingInline: 0, borderBottom: 0 }}><span className="ax-list__content"><span style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>You receive on sale</span></span><span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-viz-emerald)' }}>{netReceive()}</span></li>
              </ul>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Mint">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <label className="ax-check" style={{ gap: 'var(--ax-space-2)', alignItems: 'flex-start' }}>
                <input type="checkbox" className="ax-checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.5 }}>I confirm I own the rights to this artwork and agree to the <Link href="/pages/terms" className="ax-link">creator terms</Link>.</span>
              </label>
              <button type="submit" className="ax-btn ax-btn--primary ax-btn--block" disabled={!canMint()}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5" /><path d="M10 12l-2 -2.2l.6 -1" /></svg>
                <span className="ax-btn__label">{sale === 'auction' ? 'Mint & list auction' : 'Mint item'}</span>
              </button>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--block" onClick={saveDraft}>Save as draft</button>
              {draftSaved && <p style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-viz-emerald)', textAlign: 'center' }}>Draft saved.</p>}
              {!canMint() && <p style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textAlign: 'center' }}>Add artwork, a name, a collection &amp; accept the terms to mint.</p>}
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}

export default CreateNft;
