'use client';
/*
 * Vireo Next.js — File Manager (apps/file-manager).
 * Faithful re-expression of src/html/apps/file-manager.html: three-pane workspace
 * (quick filters + folder tree + storage meter rail, breadcrumb + toolbar + grid/
 * list browser, bulk bar), a preview drawer and an upload modal.
 * Alpine axFiles() → React useState; DOM classes/ARIA match the reference 1:1.
 */
import { useState, type ReactElement } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const svg = (path: ReactElement, w = 18) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: w, height: w }}>{path}</svg>
);

const IC: Record<string, ReactElement> = {
  pdf: svg(<><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" /><path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" /><path d="M17 18h2" /><path d="M20 15h-3v6" /><path d="M11 15v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1" /></>),
  img: svg(<><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></>),
  fig: svg(<><path d="M15 12a3 3 0 1 0 -6 0a3 3 0 0 0 6 0" /><path d="M6 15a3 3 0 1 0 6 0v-3h-3a3 3 0 0 0 -3 3" /><path d="M9 9a3 3 0 0 0 0 -6h3v6h-3" /><path d="M12 3h3a3 3 0 0 1 0 6h-3v-6" /><path d="M9 21a3 3 0 0 1 -3 -3v0a3 3 0 0 1 3 -3h3" /></>),
  zip: svg(<><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" /><path d="M16 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" /><path d="M12 15v6" /><path d="M5 15h3l-3 6h3" /></>),
  vid: svg(<><path d="M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4" /><path d="M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /></>),
  sheet: svg(<><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5" /><path d="M3 19l4 -4" /><path d="M3 15l4 4" /></>),
  doc: svg(<><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /><path d="M9 9l1 0" /><path d="M9 13l6 0" /><path d="M9 17l6 0" /></>),
  code: svg(<><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" /></>),
  recent: svg(<><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" /></>),
  star: svg(<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" />),
  shared: svg(<><path d="M5 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></>),
  trash: svg(<><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></>),
};

const C = { accent: 'var(--ax-accent)', cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)', red: 'var(--ax-danger-500)' };

interface QuickFilter { id: string; label: string; count: string; color: string; icon: ReactElement }
const QUICK_FILTERS: QuickFilter[] = [
  { id: 'all', label: 'All files', count: '1,284', color: 'var(--ax-accent)', icon: IC.doc },
  { id: 'recent', label: 'Recent', count: '24', color: 'var(--ax-viz-cyan)', icon: IC.recent },
  { id: 'starred', label: 'Starred', count: '12', color: 'var(--ax-warning-500)', icon: IC.star },
  { id: 'shared', label: 'Shared with me', count: '38', color: 'var(--ax-viz-violet)', icon: IC.shared },
  { id: 'trash', label: 'Trash', count: '7', color: 'var(--ax-text-subtle)', icon: IC.trash },
];

interface TreeNode { id: string; name: string; count: number; open?: boolean; children?: { id: string; name: string; count: number }[] }
const TREE: TreeNode[] = [
  { id: 'workspace', name: 'Workspace', count: 1284, open: true, children: [
    { id: 'design', name: 'Design', count: 312 },
    { id: 'brand', name: 'Brand Assets', count: 48 },
    { id: 'eng', name: 'Engineering', count: 506 },
    { id: 'marketing', name: 'Marketing', count: 174 },
  ] },
  { id: 'shared-root', name: 'Shared drives', count: 380, open: false, children: [
    { id: 'finance', name: 'Finance', count: 91 },
    { id: 'legal', name: 'Legal', count: 64 },
  ] },
  { id: 'archive', name: 'Archive', count: 842, open: false },
];

const FOLDERS = [
  { id: 'logos', name: 'Logos', items: 18, size: '42 MB', color: 'var(--ax-accent)' },
  { id: 'typefaces', name: 'Typefaces', items: 6, size: '88 MB', color: 'var(--ax-viz-violet)' },
  { id: 'photography', name: 'Photography', items: 124, size: '2.1 GB', color: 'var(--ax-viz-cyan)' },
  { id: 'guidelines', name: 'Guidelines', items: 9, size: '164 MB', color: 'var(--ax-viz-amber)' },
];

interface FileItem { id: number; name: string; type: string; kind: string; size: string; date: string; owner: string; color: string; icon: ReactElement; starred: boolean }
const FILES: FileItem[] = [
  { id: 1, name: 'brand-guidelines-2026.pdf', type: 'PDF document', kind: 'pdf', size: '8.4 MB', date: 'Jun 24', owner: 'Lena Brandt', color: C.red, icon: IC.pdf, starred: true },
  { id: 2, name: 'hero-banner-final.png', type: 'PNG image · 2400×1200', kind: 'image', size: '4.1 MB', date: 'Jun 23', owner: 'You', color: C.cyan, icon: IC.img, starred: false },
  { id: 3, name: 'product-shot-03.jpg', type: 'JPEG image · 3000×2000', kind: 'image', size: '6.7 MB', date: 'Jun 22', owner: 'Maya Okonkwo', color: C.violet, icon: IC.img, starred: true },
  { id: 4, name: 'aurora-ui-kit.fig', type: 'Figma file', kind: 'fig', size: '12.3 MB', date: 'Jun 21', owner: 'Tom Reyes', color: C.accent, icon: IC.fig, starred: false },
  { id: 5, name: 'launch-teaser.mp4', type: 'MP4 video · 0:48', kind: 'video', size: '128 MB', date: 'Jun 20', owner: 'Priya Nair', color: C.pink, icon: IC.vid, starred: false },
  { id: 6, name: 'icon-set-export.zip', type: 'ZIP archive', kind: 'zip', size: '2.9 MB', date: 'Jun 19', owner: 'You', color: C.amber, icon: IC.zip, starred: false },
  { id: 7, name: 'q2-campaign-budget.xlsx', type: 'Spreadsheet', kind: 'sheet', size: '612 KB', date: 'Jun 18', owner: 'Daniel Cho', color: C.emerald, icon: IC.sheet, starred: false },
  { id: 8, name: 'press-release-draft.docx', type: 'Word document', kind: 'doc', size: '248 KB', date: 'Jun 17', owner: 'Ava Sutton', color: C.cyan, icon: IC.doc, starred: false },
  { id: 9, name: 'theme-tokens.css', type: 'Stylesheet', kind: 'code', size: '34 KB', date: 'Jun 16', owner: 'Tom Reyes', color: C.violet, icon: IC.code, starred: false },
  { id: 10, name: 'social-cover-set.png', type: 'PNG image · 1600×900', kind: 'image', size: '3.3 MB', date: 'Jun 15', owner: 'You', color: C.amber, icon: IC.img, starred: false },
];

export function FileManager() {
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState('all');
  const [activeFolder, setActiveFolder] = useState('brand');
  const [selected, setSelected] = useState<number[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [active, setActive] = useState<FileItem | null>(null);
  const [tree, setTree] = useState<TreeNode[]>(TREE);

  const visibleFiles = (() => { const t = q.trim().toLowerCase(); return FILES.filter((f) => !t || f.name.toLowerCase().includes(t)); })();
  const toggle = (id: number) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const openPreview = (f: FileItem) => { setActive(f); setPreviewOpen(true); };
  const toggleNode = (id: string) => setTree((p) => p.map((n) => (n.id === id ? { ...n, open: !n.open } : n)));

  return (
    <>
      <PageHead
        title="File Manager"
        subtitle="Workspace drive — 1,284 files across 9 folders, 187.4 GB of 256 GB used."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /><path d="M12 3a9 9 0 1 0 9 9" /></svg>
              <span className="ax-btn__label">New folder</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setUploadOpen(true)}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /><path d="M9 15l3 -3l3 3" /><path d="M12 12l0 9" /></svg>
              <span className="ax-btn__label">Upload</span>
            </button>
          </>
        }
      />

      <div className="ax-fm">
        <aside className="ax-card ax-fm__rail" role="region" aria-label="Drive navigation">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', height: '100%' }}>
            <nav aria-label="Quick filters">
              <ul className="ax-list ax-list--compact" style={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
                {QUICK_FILTERS.map((f) => (
                  <li key={f.id}>
                    <button type="button" className={`ax-fm__quick${filter === f.id ? ' is-active' : ''}`} onClick={() => setFilter(f.id)}>
                      <span className="ax-fm__quick-ico" style={{ color: f.color }}>{f.icon}</span>
                      <span className="ax-fm__quick-label">{f.label}</span>
                      <span className="ax-num ax-fm__quick-count">{f.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="ax-divider" role="separator" />

            <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
              <p className="ax-fm__rail-label">Folders</p>
              <ul className="ax-fm__tree" role="tree" aria-label="Folder tree">
                {tree.map((node) => (
                  <li key={node.id} role="treeitem" aria-expanded={node.children ? (node.open ? 'true' : 'false') : undefined}>
                    <div className={`ax-fm__tree-row${activeFolder === node.id ? ' is-active' : ''}`}>
                      {node.children && (
                        <button type="button" className="ax-fm__tree-toggle" onClick={() => toggleNode(node.id)} aria-label={`${node.open ? 'Collapse ' : 'Expand '}${node.name}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transition: 'transform var(--ax-motion-fast)', width: 15, height: 15, ...(node.open ? { transform: 'rotate(90deg)' } : {}) }}><path d="M9 6l6 6l-6 6" /></svg>
                        </button>
                      )}
                      {!node.children && <span style={{ width: 15, flex: '0 0 15px' }} aria-hidden="true" />}
                      <button type="button" className="ax-fm__tree-name" onClick={() => setActiveFolder(node.id)}>
                        <svg viewBox="0 0 24 24" fill={node.open ? 'var(--ax-accent)' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 17, height: 17, color: 'var(--ax-accent)', flex: '0 0 17px' }}><path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" /></svg>
                        <span className="ax-truncate">{node.name}</span>
                        <span className="ax-num ax-fm__tree-count">{node.count}</span>
                      </button>
                    </div>
                    {node.open && node.children && (
                      <ul role="group" style={{ listStyle: 'none' }}>
                        {node.children.map((child) => (
                          <li key={child.id} role="treeitem">
                            <div className={`ax-fm__tree-row${activeFolder === child.id ? ' is-active' : ''}`} style={{ paddingInlineStart: 'var(--ax-space-5)' }}>
                              <span style={{ width: 15, flex: '0 0 15px' }} aria-hidden="true" />
                              <button type="button" className="ax-fm__tree-name" onClick={() => setActiveFolder(child.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 17, height: 17, color: 'var(--ax-text-muted)', flex: '0 0 17px' }}><path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" /></svg>
                                <span className="ax-truncate">{child.name}</span>
                                <span className="ax-num ax-fm__tree-count">{child.count}</span>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="ax-fm__storage">
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)', fontSize: 'var(--ax-text-sm)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16, color: 'var(--ax-accent)' }}><path d="M5 7a7 3 0 1 0 14 0a7 3 0 0 0 -14 0" /><path d="M5 7v5a7 3 0 0 0 14 0v-5" /><path d="M5 12v5a7 3 0 0 0 14 0v-5" /></svg>
                  Storage
                </span>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>73%</span>
              </div>
              <div className="ax-fm__meter" role="img" aria-label="187.4 GB of 256 GB used: documents 64 GB, images 52 GB, video 48 GB, other 23.4 GB">
                <span style={{ width: '25%', background: 'var(--ax-accent)' }} />
                <span style={{ width: '20.3%', background: 'var(--ax-viz-cyan)' }} />
                <span style={{ width: '18.7%', background: 'var(--ax-viz-violet)' }} />
                <span style={{ width: '9.1%', background: 'var(--ax-viz-amber)' }} />
              </div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-strong)' }}>187.4 GB</span>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>of 256 GB</span>
              </div>
              <ul className="ax-fm__legend">
                <li><i style={{ background: 'var(--ax-accent)' }} />Documents <b className="ax-num">64 GB</b></li>
                <li><i style={{ background: 'var(--ax-viz-cyan)' }} />Images <b className="ax-num">52 GB</b></li>
                <li><i style={{ background: 'var(--ax-viz-violet)' }} />Video <b className="ax-num">48 GB</b></li>
                <li><i style={{ background: 'var(--ax-viz-amber)' }} />Other <b className="ax-num">23.4 GB</b></li>
              </ul>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--block" style={{ marginTop: 'var(--ax-space-3)' }}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                <span className="ax-btn__label">Upgrade storage</span>
              </button>
            </div>
          </div>
        </aside>

        <section className="ax-card ax-fm__main" role="region" aria-label="File browser">
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <nav className="ax-fm__path" aria-label="Folder path">
              <button type="button" className="ax-fm__crumb" onClick={() => setActiveFolder('workspace')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16 }}><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>
                Workspace
              </button>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ax-fm__path-sep"><path d="M9 6l6 6l-6 6" /></svg>
              <button type="button" className="ax-fm__crumb">Design</button>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ax-fm__path-sep"><path d="M9 6l6 6l-6 6" /></svg>
              <span className="ax-fm__crumb is-current" aria-current="page">Brand Assets</span>
            </nav>
            <div className="ax-card__actions">
              <div style={{ position: 'relative' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 17, height: 17, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                <input type="search" className="ax-input ax-input--sm" placeholder="Search this folder…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 34, width: 200 }} aria-label="Search files" />
              </div>
              <div className="ax-segment" role="radiogroup" aria-label="View mode">
                <button type="button" className={`ax-segment__option${view === 'grid' ? ' is-active' : ''}`} role="radio" aria-checked={view === 'grid'} onClick={() => setView('grid')} aria-label="Grid view">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /></svg>
                </button>
                <button type="button" className={`ax-segment__option${view === 'list' ? ' is-active' : ''}`} role="radio" aria-checked={view === 'list'} onClick={() => setView('list')} aria-label="List view">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
                </button>
              </div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Sort files">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l4 -4l4 4m-4 -4v14" /><path d="M21 15l-4 4l-4 -4m4 4v-14" /></svg>
              </button>
            </div>
          </div>

          {!!selected.length && (
            <div className="ax-fm__bulk">
              <span className="ax-num" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}><span>{selected.length}</span> selected</span>
              <span className="ax-divider ax-divider--vertical" style={{ height: 18 }} role="separator" />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg><span className="ax-btn__label">Download</span></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 9l14 0a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2" /><path d="M11 5h2a2 2 0 0 1 2 2v2h-6v-2a2 2 0 0 1 2 -2" /></svg><span className="ax-btn__label">Move</span></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ color: 'var(--ax-danger-500)' }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg><span className="ax-btn__label">Delete</span></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" style={{ marginInlineStart: 'auto' }} aria-label="Clear selection" onClick={() => setSelected([])}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
          )}

          <div className="ax-card__body" style={{ paddingTop: 'var(--ax-space-4)' }}>
            <p className="ax-fm__section">Folders <span className="ax-num" style={{ color: 'var(--ax-text-subtle)' }}>4</span></p>
            <div className="ax-fm__folders">
              {FOLDERS.map((folder) => (
                <button key={folder.id} type="button" className="ax-fm__folder" onClick={() => setActiveFolder(folder.id)}>
                  <span className="ax-fm__folder-ico" style={{ color: folder.color }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ width: 22, height: 22 }}><path d="M9 3a1 1 0 0 1 .608 .206l.1 .087l2.706 2.707h6.586a3 3 0 0 1 2.995 2.824l.005 .176v8a3 3 0 0 1 -2.824 2.995l-.176 .005h-14a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-11a3 3 0 0 1 2.824 -2.995l.176 -.005h4z" /></svg>
                  </span>
                  <span className="ax-fm__folder-meta">
                    <span className="ax-truncate">{folder.name}</span>
                    <span className="ax-num ax-fm__folder-sub"><span>{folder.items}</span> items · <span>{folder.size}</span></span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ax-fm__folder-more"><path d="M5 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M17 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
                </button>
              ))}
            </div>

            <p className="ax-fm__section" style={{ marginTop: 'var(--ax-space-6)' }}>Files <span className="ax-num" style={{ color: 'var(--ax-text-subtle)' }}>{visibleFiles.length}</span></p>

            {view === 'grid' && (
              <div className="ax-fm__grid">
                {visibleFiles.map((file) => (
                  <article key={file.id} className={`ax-fm__tile${selected.includes(file.id) ? ' is-selected' : ''}`} onClick={() => openPreview(file)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') openPreview(file); }} role="button" aria-label={file.name}>
                    <label className="ax-fm__check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="ax-checkbox" checked={selected.includes(file.id)} onChange={() => toggle(file.id)} aria-label={`Select ${file.name}`} />
                    </label>
                    <button type="button" className="ax-fm__tile-more" onClick={(e) => e.stopPropagation()} aria-label="File actions">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M17 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
                    </button>
                    {file.kind === 'image' ? (
                      <span className="ax-fm__thumb" style={{ background: `linear-gradient(135deg, color-mix(in oklab,${file.color} 36%,var(--ax-surface-solid)), color-mix(in oklab,${file.color} 12%,var(--ax-surface-solid)))` }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 30, height: 30, opacity: 0.92 }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
                      </span>
                    ) : (
                      <span className="ax-fm__thumb" style={{ background: 'var(--ax-surface-subtle)' }}>
                        <span style={{ color: file.color }} className="ax-fm__thumb-glyph">{file.icon}</span>
                      </span>
                    )}
                    <div className="ax-fm__tile-body">
                      <p className="ax-fm__tile-name ax-clamp">{file.name}</p>
                      <p className="ax-num ax-fm__tile-sub"><span>{file.size}</span> · <span>{file.date}</span></p>
                    </div>
                    {file.starred && <svg viewBox="0 0 24 24" fill="var(--ax-warning-500)" stroke="var(--ax-warning-500)" strokeWidth={1.5} aria-hidden="true" className="ax-fm__tile-star"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>}
                  </article>
                ))}
              </div>
            )}

            {view === 'list' && (
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col" style={{ width: 36 }}><input type="checkbox" className="ax-checkbox" onChange={(e) => setSelected(e.target.checked ? visibleFiles.map((f) => f.id) : [])} aria-label="Select all files" /></th>
                      <th className="ax-table__th" scope="col">Name</th>
                      <th className="ax-table__th" scope="col">Owner</th>
                      <th className="ax-table__th" scope="col">Modified</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Size</th>
                      <th className="ax-table__th" scope="col" style={{ width: 44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFiles.map((file) => (
                      <tr key={file.id} className={`ax-table__row${selected.includes(file.id) ? ' is-selected' : ''}`} onClick={() => openPreview(file)} style={{ cursor: 'pointer' }}>
                        <td className="ax-table__td" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="ax-checkbox" checked={selected.includes(file.id)} onChange={() => toggle(file.id)} aria-label={`Select ${file.name}`} /></td>
                        <td className="ax-table__td">
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                            <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${file.color} 16%,transparent)`, color: file.color }}>{file.icon}</span>
                            <div style={{ minWidth: 0 }}>
                              <div className="ax-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', maxWidth: 280 }}>{file.name}</div>
                              <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{file.type}</div>
                            </div>
                          </div>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{file.owner}</td>
                        <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{file.date}</td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{file.size}</td>
                        <td className="ax-table__td" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="File actions"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M17 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {previewOpen && active && (
        <div className="ax-fm__drawer-backdrop" onClick={() => setPreviewOpen(false)}>
          <aside className="ax-card ax-fm__drawer ax-fm-slide" role="dialog" aria-modal="true" aria-label="File preview" onClick={(e) => e.stopPropagation()}>
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">{active.type}</span>
                <h2 className="ax-card__title ax-truncate" style={{ maxWidth: 340 }}>{active.name}</h2>
              </div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Close preview" onClick={() => setPreviewOpen(false)}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', overflowY: 'auto' }}>
              <div className="ax-fm__preview" style={active.kind === 'image' ? { background: `linear-gradient(135deg, color-mix(in oklab,${active.color} 40%,var(--ax-surface-solid)), color-mix(in oklab,${active.color} 14%,var(--ax-surface-solid)))` } : { background: 'var(--ax-surface-subtle)' }}>
                {active.kind === 'image' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 48, height: 48, opacity: 0.9 }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
                ) : (
                  <span style={{ color: active.color, display: 'inline-flex', width: 54, height: 54 }}>{active.icon}</span>
                )}
              </div>

              <div className="ax-fm__drawer-actions">
                <button type="button" className="ax-btn ax-btn--primary"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg><span className="ax-btn__label">Download</span></button>
                <button type="button" className="ax-btn ax-btn--secondary"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M8.7 10.7l6.6 -3.4" /><path d="M8.7 13.3l6.6 3.4" /><path d="M14 5.5a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M14 18.5a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg><span className="ax-btn__label">Share</span></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Star file"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg></button>
              </div>

              <div>
                <p className="ax-fm__rail-label">Details</p>
                <ul className="ax-fm__meta-list">
                  <li><span>Type</span><b>{active.type}</b></li>
                  <li><span>Size</span><b className="ax-num">{active.size}</b></li>
                  <li><span>Modified</span><b className="ax-num">{active.date}, 2026</b></li>
                  <li><span>Owner</span><b>{active.owner}</b></li>
                  <li><span>Location</span><b>Workspace / Design / Brand Assets</b></li>
                </ul>
              </div>

              <div>
                <p className="ax-fm__rail-label">Shared with</p>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', justifyContent: 'space-between' }}>
                  <div className="ax-avatar-group" aria-label="Shared with 3 people">
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 20%,transparent)', color: 'var(--ax-viz-cyan)', fontWeight: 600 }} title="Maya Okonkwo">MO</span>
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 20%,transparent)', color: 'var(--ax-viz-violet)', fontWeight: 600 }} title="Tom Reyes">TR</span>
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle ax-avatar__overflow" style={{ fontWeight: 600 }}>+1</span>
                  </div>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg><span className="ax-btn__label">Invite</span></button>
                </div>
              </div>
            </div>
            <div className="ax-card__footer" style={{ display: 'flex', gap: 'var(--ax-space-3)' }}>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--block" onClick={() => setPreviewOpen(false)}>Close</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" style={{ color: 'var(--ax-danger-500)' }} aria-label="Delete file"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>
            </div>
          </aside>
        </div>
      )}

      {uploadOpen && (
        <div className="ax-fm__drawer-backdrop" style={{ alignItems: 'center', justifyContent: 'center' }} onClick={() => setUploadOpen(false)}>
          <div className="ax-card" role="dialog" aria-modal="true" aria-label="Upload files" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px,100%)' }}>
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Upload files</h2>
                <p className="ax-card__subtitle">To Workspace / Design / Brand Assets</p>
              </div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Close upload" onClick={() => setUploadOpen(false)}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
            <div className="ax-card__body">
              <div className="ax-fm__dropzone">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 38, height: 38, color: 'var(--ax-accent)' }}><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /><path d="M9 15l3 -3l3 3" /><path d="M12 12l0 9" /></svg>
                <p style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', marginTop: 'var(--ax-space-3)' }}>Drag &amp; drop files here</p>
                <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>or <span style={{ color: 'var(--ax-accent)', fontWeight: 'var(--ax-weight-medium)' }}>browse</span> from your device</p>
                <p className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 'var(--ax-space-2)' }}>Max 2 GB per file · PDF, PNG, JPG, FIG, MP4, ZIP</p>
              </div>
              <div style={{ marginTop: 'var(--ax-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                <div className="ax-fm__upload-row">
                  <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 16%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg></span>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span className="ax-truncate" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)', maxWidth: 220 }}>hero-banner-final.png</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>68%</span></div>
                    <div className="ax-progress ax-progress--xs" style={{ marginTop: 5 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '68%' }} /></div></div>
                  </div>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Cancel upload"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
                </div>
                <div className="ax-fm__upload-row">
                  <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 16%,transparent)', color: 'var(--ax-viz-emerald)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M5 12l5 5l10 -10" /></svg></span>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span className="ax-truncate" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)', maxWidth: 220 }}>brand-guidelines.pdf</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-viz-emerald)' }}>Done</span></div>
                    <div className="ax-progress ax-progress--xs ax-progress--success" style={{ marginTop: 5 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '100%' }} /></div></div>
                  </div>
                  <span style={{ width: 30 }} aria-hidden="true" />
                </div>
              </div>
            </div>
            <div className="ax-card__footer" style={{ display: 'flex', gap: 'var(--ax-space-3)', justifyContent: 'flex-end' }}>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setUploadOpen(false)}>Cancel</button>
              <button type="button" className="ax-btn ax-btn--primary" onClick={() => setUploadOpen(false)}>Upload 2 files</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .ax-fm { display:grid; grid-template-columns:288px minmax(0,1fr); gap:var(--ax-space-6); align-items:start; }
        .ax-fm__rail { position:sticky; top:var(--ax-space-6); align-self:start; height:calc(100vh - var(--ax-header-h, 64px) - var(--ax-space-10)); }
        .ax-fm__rail .ax-card__body { padding:var(--ax-space-4); }
        .ax-fm__quick { display:flex; align-items:center; gap:var(--ax-space-3); width:100%; padding:var(--ax-space-2) var(--ax-space-3); border:0; background:transparent; border-radius:var(--ax-radius-md); cursor:pointer; color:var(--ax-text); font-size:var(--ax-text-sm); transition:background var(--ax-motion-fast); }
        .ax-fm__quick:hover { background:var(--ax-fill-hover); }
        .ax-fm__quick.is-active { background:var(--ax-accent-wash); color:var(--ax-accent); box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--ax-accent) 22%,transparent); }
        .ax-fm__quick-ico { display:inline-flex; width:18px; height:18px; flex:0 0 18px; }
        .ax-fm__quick-ico svg { width:18px; height:18px; }
        .ax-fm__quick-label { flex:1 1 auto; text-align:start; font-weight:var(--ax-weight-medium); }
        .ax-fm__quick-count { font-family:var(--ax-font-mono); font-size:var(--ax-text-xs); color:var(--ax-text-subtle); }
        .ax-fm__rail-label { font-size:var(--ax-text-2xs); font-weight:var(--ax-weight-semibold); letter-spacing:.05em; text-transform:uppercase; color:var(--ax-text-subtle); margin-bottom:var(--ax-space-2); }
        .ax-fm__tree { list-style:none; display:flex; flex-direction:column; gap:1px; }
        .ax-fm__tree ul { display:flex; flex-direction:column; gap:1px; margin-top:1px; }
        .ax-fm__tree-row { display:flex; align-items:center; border-radius:var(--ax-radius-sm); transition:background var(--ax-motion-fast); }
        .ax-fm__tree-row:hover { background:var(--ax-fill-hover); }
        .ax-fm__tree-row.is-active { background:var(--ax-accent-wash); }
        .ax-fm__tree-row.is-active .ax-fm__tree-name { color:var(--ax-accent); }
        .ax-fm__tree-toggle { display:inline-flex; align-items:center; justify-content:center; width:22px; height:30px; border:0; background:transparent; color:var(--ax-text-subtle); cursor:pointer; flex:0 0 22px; }
        .ax-fm__tree-name { display:flex; align-items:center; gap:var(--ax-space-2); flex:1 1 auto; min-width:0; padding:var(--ax-space-2) var(--ax-space-2) var(--ax-space-2) 0; border:0; background:transparent; color:var(--ax-text); font-size:var(--ax-text-sm); cursor:pointer; text-align:start; }
        .ax-fm__tree-count { margin-inline-start:auto; font-family:var(--ax-font-mono); font-size:var(--ax-text-2xs); color:var(--ax-text-subtle); }
        .ax-fm__storage { background:var(--ax-surface-subtle); border:1px solid var(--ax-border); border-radius:var(--ax-radius-lg); padding:var(--ax-space-4); }
        .ax-fm__meter { display:flex; gap:2px; height:8px; border-radius:var(--ax-radius-pill); overflow:hidden; background:var(--ax-fill-hover); }
        .ax-fm__meter span { display:block; height:100%; }
        .ax-fm__legend { list-style:none; display:grid; grid-template-columns:1fr 1fr; gap:var(--ax-space-2) var(--ax-space-3); margin-top:var(--ax-space-3); }
        .ax-fm__legend li { display:flex; align-items:center; gap:6px; font-size:var(--ax-text-xs); color:var(--ax-text-muted); }
        .ax-fm__legend i { width:8px; height:8px; border-radius:2px; flex:0 0 8px; }
        .ax-fm__legend b { margin-inline-start:auto; font-family:var(--ax-font-mono); color:var(--ax-text-strong); }
        .ax-fm__main { min-height:520px; }
        .ax-fm__path { display:flex; align-items:center; gap:var(--ax-space-1); flex-wrap:wrap; min-width:0; }
        .ax-fm__crumb { display:inline-flex; align-items:center; gap:var(--ax-space-2); padding:4px var(--ax-space-2); border:0; background:transparent; border-radius:var(--ax-radius-sm); color:var(--ax-text-muted); font-size:var(--ax-text-sm); font-weight:var(--ax-weight-medium); cursor:pointer; }
        .ax-fm__crumb:hover:not(.is-current) { background:var(--ax-fill-hover); color:var(--ax-text-strong); }
        .ax-fm__crumb.is-current { color:var(--ax-text-strong); font-weight:var(--ax-weight-semibold); cursor:default; }
        .ax-fm__path-sep { width:14px; height:14px; color:var(--ax-text-subtle); flex:0 0 14px; }
        .ax-fm__bulk { display:flex; align-items:center; gap:var(--ax-space-3); padding:var(--ax-space-2) var(--ax-space-5); background:var(--ax-accent-wash); border-block:1px solid var(--ax-border); }
        .ax-fm__section { font-size:var(--ax-text-sm); font-weight:var(--ax-weight-semibold); color:var(--ax-text-strong); margin-bottom:var(--ax-space-3); display:flex; align-items:center; gap:var(--ax-space-2); }
        .ax-fm__folders { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:var(--ax-space-3); }
        .ax-fm__folder { display:flex; align-items:center; gap:var(--ax-space-3); padding:var(--ax-space-3); background:var(--ax-surface-subtle); border:1px solid var(--ax-border); border-radius:var(--ax-radius-md); cursor:pointer; text-align:start; transition:border-color var(--ax-motion-fast), box-shadow var(--ax-motion-fast); }
        .ax-fm__folder:hover { border-color:var(--ax-border-strong); box-shadow:var(--ax-shadow-sm); }
        .ax-fm__folder-ico { display:inline-flex; flex:0 0 auto; }
        .ax-fm__folder-meta { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:1px; }
        .ax-fm__folder-meta > span:first-child { font-weight:var(--ax-weight-medium); color:var(--ax-text-strong); font-size:var(--ax-text-sm); }
        .ax-fm__folder-sub { font-family:var(--ax-font-mono); font-size:var(--ax-text-2xs); color:var(--ax-text-subtle); }
        .ax-fm__folder-more { width:18px; height:18px; color:var(--ax-text-subtle); flex:0 0 18px; opacity:0; transition:opacity var(--ax-motion-fast); }
        .ax-fm__folder:hover .ax-fm__folder-more { opacity:1; }
        .ax-fm__grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(168px,1fr)); gap:var(--ax-space-4); }
        .ax-fm__tile { position:relative; display:flex; flex-direction:column; gap:var(--ax-space-3); padding:var(--ax-space-3); background:var(--ax-surface-subtle); border:1px solid var(--ax-border); border-radius:var(--ax-radius-md); cursor:pointer; text-align:start; transition:border-color var(--ax-motion-fast), box-shadow var(--ax-motion-fast); }
        .ax-fm__tile:hover { border-color:var(--ax-border-strong); box-shadow:var(--ax-shadow-sm); }
        .ax-fm__tile:focus-visible { outline:none; box-shadow:0 0 0 2px var(--ax-canvas), 0 0 0 4px var(--ax-focus-ring); }
        .ax-fm__tile.is-selected { border-color:var(--ax-accent); box-shadow:0 0 0 1px var(--ax-accent); background:var(--ax-accent-wash); }
        .ax-fm__check { position:absolute; top:var(--ax-space-3); left:var(--ax-space-3); z-index:2; opacity:0; transition:opacity var(--ax-motion-fast); }
        .ax-fm__tile:hover .ax-fm__check, .ax-fm__tile.is-selected .ax-fm__check { opacity:1; }
        .ax-fm__tile-more { position:absolute; top:var(--ax-space-3); right:var(--ax-space-3); z-index:2; display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border:0; border-radius:var(--ax-radius-sm); background:var(--ax-surface-overlay); color:var(--ax-text-muted); cursor:pointer; opacity:0; transition:opacity var(--ax-motion-fast); }
        .ax-fm__tile-more svg { width:16px; height:16px; }
        .ax-fm__tile:hover .ax-fm__tile-more { opacity:1; }
        .ax-fm__thumb { display:flex; align-items:center; justify-content:center; aspect-ratio:4/3; border-radius:var(--ax-radius-sm); overflow:hidden; }
        .ax-fm__thumb-glyph { display:inline-flex; width:34px; height:34px; }
        .ax-fm__thumb-glyph svg { width:34px; height:34px; }
        .ax-fm__tile-body { min-width:0; }
        .ax-fm__tile-name { font-size:var(--ax-text-sm); font-weight:var(--ax-weight-medium); color:var(--ax-text-strong); line-height:1.35; }
        .ax-fm__tile-sub { font-family:var(--ax-font-mono); font-size:var(--ax-text-2xs); color:var(--ax-text-subtle); margin-top:2px; }
        .ax-fm__tile-star { position:absolute; bottom:var(--ax-space-3); right:var(--ax-space-3); width:15px; height:15px; }
        .ax-clamp { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .ax-fm__drawer-backdrop { position:fixed; inset:0; z-index:60; display:flex; justify-content:flex-end; background:rgba(0,0,0,.45); backdrop-filter:blur(2px); }
        .ax-fm__drawer { width:min(420px,100%); height:100%; border-radius:0; display:flex; flex-direction:column; }
        .ax-fm__drawer .ax-card__body { flex:1 1 auto; }
        .ax-fm__preview { display:flex; align-items:center; justify-content:center; aspect-ratio:4/3; border-radius:var(--ax-radius-lg); box-shadow:var(--ax-shadow-sm); }
        .ax-fm__drawer-actions { display:flex; gap:var(--ax-space-3); }
        .ax-fm__drawer-actions > .ax-btn:first-child { flex:1 1 auto; }
        .ax-fm__meta-list { list-style:none; display:flex; flex-direction:column; gap:var(--ax-space-3); }
        .ax-fm__meta-list li { display:flex; align-items:center; justify-content:space-between; gap:var(--ax-space-4); font-size:var(--ax-text-sm); }
        .ax-fm__meta-list span { color:var(--ax-text-subtle); }
        .ax-fm__meta-list b { color:var(--ax-text-strong); font-weight:var(--ax-weight-medium); text-align:end; }
        .ax-fm__dropzone { display:flex; flex-direction:column; align-items:center; text-align:center; padding:var(--ax-space-7) var(--ax-space-5); border:2px dashed var(--ax-border-strong); border-radius:var(--ax-radius-md); background:var(--ax-surface-subtle); }
        .ax-fm__upload-row { display:flex; align-items:center; gap:var(--ax-space-3); padding:var(--ax-space-2) var(--ax-space-3); background:var(--ax-surface-subtle); border:1px solid var(--ax-border); border-radius:var(--ax-radius-md); }
        .ax-fm-slide { animation:axFmSlide .2s var(--ax-ease-standard); }
        @keyframes axFmSlide { from { transform:translateX(28px); opacity:0; } to { transform:translateX(0); opacity:1; } }
        @media (max-width:992px){ .ax-fm { grid-template-columns:1fr; } .ax-fm__rail { position:static; height:auto; } }
        @media (prefers-reduced-motion: reduce){ .ax-fm-slide, .ax-fm__tile, .ax-fm__folder { animation:none; transition:none; } }
      `}</style>
    </>
  );
}

export default FileManager;
