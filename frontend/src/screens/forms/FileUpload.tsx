'use client';
/*
 * Vireo Next.js — Forms / File upload (route "forms/file-upload").
 *
 * Faithful re-expression of src/html/forms/file-upload.html: a primary drag/drop
 * dropzone with a per-file progress list (uploading/done/error states + retry), an
 * avatar uploader + accepted-types rail, and an image preview grid (add tile, primary
 * badge, hover actions). The axFileUpload() Alpine factory is ported to React state;
 * file-type glyphs become ReactNode icons. Page-local hover <style> carried verbatim.
 * Classes + ARIA match the reference 1:1.
 */
import { useRef, useState, type ReactNode, type DragEvent } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const C = { cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)', accent: 'var(--ax-accent)' };

const ICON: Record<string, ReactNode> = {
  pdf: <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" /><path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" /><path d="M17 18h2" /><path d="M20 15h-3v6" /><path d="M11 15v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1z" /></>,
  doc: <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /><path d="M9 9l1 0" /><path d="M9 13l6 0" /><path d="M9 17l6 0" /></>,
  xls: <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /><path d="M10 12l4 5" /><path d="M10 17l4 -5" /></>,
  img: <><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></>,
};

interface FileItem { id: number; name: string; size: string; progress: number; status: 'done' | 'uploading' | 'error'; error?: string; c: string; icon: keyof typeof ICON; }
interface ImgItem { id: number; name: string; primary: boolean; bg: string; }

const INITIAL_FILES: FileItem[] = [
  { id: 1, name: 'Q3-financial-report.pdf', size: '3.4 MB', progress: 100, status: 'done', c: C.pink, icon: 'pdf' },
  { id: 2, name: 'brand-guidelines-v4.docx', size: '1.2 MB', progress: 64, status: 'uploading', c: C.cyan, icon: 'doc' },
  { id: 3, name: 'pricing-model-2026.xlsx', size: '860 KB', progress: 38, status: 'uploading', c: C.emerald, icon: 'xls' },
  { id: 4, name: 'hero-render-final.png', size: '28.6 MB', progress: 0, status: 'error', error: 'Exceeds 25 MB limit', c: C.violet, icon: 'img' },
];
const INITIAL_IMAGES: ImgItem[] = [
  { id: 101, name: 'lamp-brass-01.jpg', primary: true, bg: 'linear-gradient(135deg,var(--ax-viz-cyan),var(--ax-viz-violet))' },
  { id: 102, name: 'mug-slate-02.jpg', primary: false, bg: 'linear-gradient(135deg,var(--ax-viz-pink),var(--ax-viz-amber))' },
  { id: 103, name: 'riser-walnut-03.jpg', primary: false, bg: 'linear-gradient(135deg,var(--ax-viz-emerald),var(--ax-viz-cyan))' },
  { id: 104, name: 'desk-setup-wide.jpg', primary: false, bg: 'linear-gradient(135deg,var(--ax-viz-violet),var(--ax-viz-pink))' },
  { id: 105, name: 'studio-detail-05.jpg', primary: false, bg: 'linear-gradient(135deg,var(--ax-viz-amber),var(--ax-viz-cyan))' },
];

const HOVER_STYLE = `
.ax-file-tile__bar { opacity:0; transition:opacity var(--ax-motion-fast) var(--ax-ease-standard); }
.ax-file-tile:hover .ax-file-tile__bar, .ax-file-tile:focus-within .ax-file-tile__bar { opacity:1; }
@media (prefers-reduced-motion: reduce){ .ax-file-tile__bar { opacity:1; } }
`;

const fmt = (b: number) => { if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'; return Math.max(1, Math.round(b / 1024)) + ' KB'; };

export function FileUpload() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<FileItem[]>(INITIAL_FILES);
  const [images, setImages] = useState<ImgItem[]>(INITIAL_IMAGES);
  const uidRef = useRef(10);
  const inputRef = useRef<HTMLInputElement>(null);

  const queue = (list: FileList | null) => {
    Array.from(list || []).forEach((f) => {
      const big = f.size > 25 * 1024 * 1024;
      uidRef.current += 1;
      setFiles((fs) => [...fs, { id: uidRef.current, name: f.name, size: fmt(f.size), progress: 0, status: big ? 'error' : 'uploading', error: big ? 'Exceeds 25 MB limit' : '', c: C.amber, icon: 'doc' }]);
    });
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { queue(e.target.files); e.target.value = ''; };
  const onDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(false); queue(e.dataTransfer.files); };
  const retry = (i: number) => setFiles((fs) => fs.map((f, idx) => idx === i ? { ...f, status: 'uploading', progress: 0, error: '' } : f));
  const removeFile = (i: number) => setFiles((fs) => fs.filter((_, idx) => idx !== i));
  const clearAll = () => setFiles([]);
  const totalSize = () => '36.0 MB';
  const doneCount = () => files.filter((f) => f.status === 'done').length;
  const setPrimary = (i: number) => setImages((ims) => ims.map((im, j) => ({ ...im, primary: j === i })));
  const removeImage = (i: number) => setImages((ims) => ims.filter((_, idx) => idx !== i));
  const upload = () => {
    setUploading(true);
    setFiles((fs) => fs.map((f) => f.status !== 'error' ? { ...f, status: 'uploading' } : f));
    setTimeout(() => { setFiles((fs) => fs.map((f) => f.status === 'uploading' ? { ...f, progress: 100, status: 'done' } : f)); setUploading(false); }, 1100);
  };

  return (
    <>
      <PageHead
        title="File upload"
        subtitle="Dropzones, per-file progress and an image preview grid — keyboard and screen-reader ready."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost" onClick={clearAll}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
              <span className="ax-btn__label">Clear all</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={upload} aria-busy={uploading}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">{uploading ? 'Uploading…' : 'Upload all'}</span>
            </button>
          </>
        }
      />

      <style>{HOVER_STYLE}</style>

      <div className="ax-dash-grid">
        {/* PRIMARY DROPZONE + FILE LIST */}
        <section className="ax-card ax-col--8" role="region" aria-label="File dropzone">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Drag &amp; drop</span>
              <h2 className="ax-card__title">Upload documents</h2>
              <p className="ax-card__subtitle">PDF, DOCX, XLSX or images up to 25 MB each.</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{files.length} file{files.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-dropzone">
              <div className={`ax-dropzone__area ${dragging ? 'is-dragover' : ''}`.trim()} role="button" tabIndex={0}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setDragging(false); }} onDrop={onDrop}
                onClick={() => inputRef.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); else if (e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
                aria-label="Drop files here or click to browse">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /><path d="M9 15l3 -3l3 3" /><path d="M12 12l0 9" /></svg>
                <div style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>{dragging ? 'Drop to upload' : 'Drag files here or click to browse'}</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Maximum 25 MB per file · up to 20 files</div>
                <input type="file" ref={inputRef} multiple className="visually-hidden" onChange={onPick} aria-hidden="true" tabIndex={-1} />
              </div>

              <ul className="ax-dropzone__list" aria-live="polite">
                {files.map((f, i) => (
                  <li key={f.id} className="ax-dropzone__file" style={{ alignItems: 'flex-start' }}>
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${f.c} 18%,transparent)`, color: f.c, marginTop: 2 }}>
                      <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[f.icon]}</svg>
                    </span>
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)' }}>
                        <span className="ax-truncate" style={{ fontWeight: 500, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{f.name}</span>
                        <span className="ax-num" style={{ flex: '0 0 auto', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: f.status === 'error' ? 'var(--ax-danger-500)' : 'var(--ax-text-subtle)' }}>{f.status === 'done' ? f.size : (f.status === 'error' ? 'Failed' : f.progress + '%')}</span>
                      </div>
                      {f.status === 'uploading' && <div className="ax-progress ax-progress--xs" style={{ marginTop: 6 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: f.progress + '%' }} /></div></div>}
                      {f.status === 'done' && <div className="ax-cluster" style={{ gap: 5, marginTop: 4, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-viz-emerald)' }}><svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg><span>{f.size} · uploaded</span></div>}
                      {f.status === 'error' && <div className="ax-cluster" style={{ gap: 5, marginTop: 4, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-danger-500)' }}><svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.24 3.957l-8.422 14.06a1.989 1.989 0 0 0 1.7 2.983h16.845a1.989 1.989 0 0 0 1.7 -2.983l-8.423 -14.06a1.989 1.989 0 0 0 -3.4 0" /></svg><span>{f.error}</span></div>}
                    </div>
                    {f.status === 'error' && <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => retry(i)} aria-label="Retry upload"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg></button>}
                    <button type="button" className="ax-dropzone__remove" onClick={() => removeFile(i)} aria-label={'Remove ' + f.name}><svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
                  </li>
                ))}
                {!files.length && <li style={{ textAlign: 'center', padding: 'var(--ax-space-5)', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-sm)' }}>No files queued yet.</li>}
              </ul>
            </div>
          </div>
          <div className="ax-card__footer" style={{ justifyContent: 'space-between' }}>
            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Total {totalSize()}</span>
            <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{doneCount()} of {files.length} complete</span>
          </div>
        </section>

        {/* SIDE: AVATAR + CONSTRAINTS */}
        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="Avatar upload">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Profile photo</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-4)', textAlign: 'center' }}>
              <div style={{ position: 'relative' }}>
                <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ width: 96, height: 96, background: 'color-mix(in oklab,var(--ax-accent) 20%,transparent)', color: 'var(--ax-accent)' }}>
                  <b style={{ fontSize: 'var(--ax-text-2xl)', fontFamily: 'var(--ax-font-display)' }}>JA</b>
                </span>
                <button type="button" className="ax-btn ax-btn--primary ax-btn--icon ax-btn--sm" style={{ position: 'absolute', bottom: -4, insetInlineEnd: -4, borderRadius: '50%' }} aria-label="Change photo">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
                </button>
              </div>
              <div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm">Upload new photo</button>
                <p style={{ margin: 'var(--ax-space-2) 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Square JPG or PNG, at least 256×256px.</p>
              </div>
            </div>
          </section>
          <section className="ax-card" role="region" aria-label="Upload rules">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Accepted files</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-sm)' }}><span style={{ color: 'var(--ax-text)' }}>Documents</span><span className="ax-mono" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>.pdf .docx .xlsx</span></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-sm)' }}><span style={{ color: 'var(--ax-text)' }}>Images</span><span className="ax-mono" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>.jpg .png .webp</span></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-sm)' }}><span style={{ color: 'var(--ax-text)' }}>Max size</span><span className="ax-mono" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>25 MB</span></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-sm)' }}><span style={{ color: 'var(--ax-text)' }}>Max count</span><span className="ax-mono" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>20 files</span></div>
            </div>
          </section>
        </aside>

        {/* IMAGE PREVIEW GRID */}
        <section className="ax-card ax-col--12" role="region" aria-label="Image gallery upload">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Media library</span>
              <h2 className="ax-card__title">Image preview grid</h2>
              <p className="ax-card__subtitle">Thumbnails with hover actions · the first dashed tile adds more.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 'var(--ax-space-4)' }}>
              <button type="button" className="ax-center" onClick={() => inputRef.current?.click()} style={{ aspectRatio: '1', border: '1.5px dashed var(--ax-border-strong)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface)', color: 'var(--ax-text-muted)', cursor: 'pointer', gap: 'var(--ax-space-2)', flexDirection: 'column', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Add images">
                <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                <span style={{ fontSize: 'var(--ax-text-xs)' }}>Add images</span>
              </button>
              {images.map((img, i) => (
                <figure key={img.id} style={{ position: 'relative', margin: 0, aspectRatio: '1', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', border: '1px solid var(--ax-border)' }} className="ax-file-tile">
                  <div className="ax-fill" style={{ background: img.bg }} />
                  <span aria-hidden="true" className="ax-center ax-fill" style={{ position: 'absolute', inset: 0, color: 'rgba(255,255,255,.85)' }}>
                    <svg viewBox="0 0 24 24" width={30} height={30} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
                  </span>
                  {img.primary && <span className="ax-badge ax-badge--solid ax-badge--accent ax-badge--sm ax-badge--pill" style={{ position: 'absolute', top: 8, insetInlineStart: 8 }}>Primary</span>}
                  <figcaption className="ax-file-tile__bar" style={{ position: 'absolute', insetInline: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--ax-space-2)', padding: 'var(--ax-space-2) var(--ax-space-3)', background: 'linear-gradient(to top,rgba(0,0,0,.62),transparent)' }}>
                    <span className="ax-truncate" style={{ color: '#fff', fontSize: 'var(--ax-text-2xs)' }}>{img.name}</span>
                    <span className="ax-cluster" style={{ gap: 4, flex: '0 0 auto' }}>
                      <button type="button" onClick={() => setPrimary(i)} aria-label="Set as primary" style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'rgba(255,255,255,.18)', border: 0, color: '#fff', cursor: 'pointer' }}><svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg></button>
                      <button type="button" onClick={() => removeImage(i)} aria-label="Delete image" style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'rgba(255,255,255,.18)', border: 0, color: '#fff', cursor: 'pointer' }}><svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default FileUpload;
