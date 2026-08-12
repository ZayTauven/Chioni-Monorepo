'use client';
/*
 * Vireo Next.js — Media Player (apps/media-player).
 * Faithful re-expression of src/html/apps/media-player.html: library rail (smart
 * views + playlists + device), now-playing card (cover, scrubber, transport,
 * volume, visualizer) and the up-next queue. Alpine axMedia() → React state +
 * window key handlers (space / arrows). DOM classes/ARIA match the reference 1:1.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const C = { accent: 'var(--ax-accent)', cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)' };

const IC: Record<string, ReactElement> = {
  library: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M13 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M9 17v-13h10v13" /><path d="M9 8h10" /></svg>,
  recent: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M12 8l0 4l2 2" /><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" /></svg>,
  fav: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg>,
  radio: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M14 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M5 6h13a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-13a1 1 0 0 1 -1 -1v-9.5l5 -2.5" /><path d="M7 12v.01" /></svg>,
};

const VIEWS = [
  { id: 'library', label: 'Library', icon: IC.library, count: 248 },
  { id: 'recent', label: 'Recently played', icon: IC.recent, count: 32 },
  { id: 'favorites', label: 'Favorites', icon: IC.fav, count: 54 },
  { id: 'radio', label: 'Stations', icon: IC.radio, count: 12 },
];
const PLAYLISTS = [
  { id: 'pl1', label: 'Focus Flow', color: C.accent, count: 18 },
  { id: 'pl2', label: 'Deep House Late', color: C.cyan, count: 42 },
  { id: 'pl3', label: 'Morning Acoustic', color: C.amber, count: 24 },
  { id: 'pl4', label: 'Synthwave Drive', color: C.violet, count: 31 },
  { id: 'pl5', label: 'Lo-Fi Study', color: C.pink, count: 60 },
  { id: 'pl6', label: 'Jazz & Rain', color: C.emerald, count: 19 },
  { id: 'pl7', label: 'Workout 140 BPM', color: C.cyan, count: 28 },
];

interface Track { id: number; title: string; artist: string; album: string; dur: number; angle: number; c1: string; c2: string; fav: boolean }
const SEED: Track[] = [
  { id: 1, title: 'Verdigris Skyline', artist: 'Aurora Lights', album: 'Glass Atlas', dur: 271, angle: 135, c1: C.accent, c2: C.cyan, fav: true },
  { id: 2, title: 'Slow Tide', artist: 'Mara Vey', album: 'Northern Quiet', dur: 224, angle: 160, c1: C.violet, c2: C.pink, fav: false },
  { id: 3, title: 'Paper Planes', artist: 'The Hollowells', album: 'Field Notes', dur: 198, angle: 120, c1: C.amber, c2: C.accent, fav: false },
  { id: 4, title: 'Midnight Drive', artist: 'Neon Foxes', album: 'Synthwave Drive', dur: 312, angle: 200, c1: C.cyan, c2: C.violet, fav: true },
  { id: 5, title: 'Warm Static', artist: 'Bloom Theory', album: 'Lo-Fi Study Vol. 3', dur: 176, angle: 145, c1: C.pink, c2: C.amber, fav: false },
  { id: 6, title: 'Coastline at Dawn', artist: 'Saoirse Quinn', album: 'Morning Acoustic', dur: 243, angle: 110, c1: C.emerald, c2: C.cyan, fav: false },
  { id: 7, title: 'Brass & Rain', artist: 'Otis Lane Trio', album: 'Jazz & Rain', dur: 289, angle: 170, c1: C.amber, c2: C.pink, fav: true },
  { id: 8, title: 'Pulse Width', artist: 'Kade Moreno', album: 'Workout 140', dur: 205, angle: 185, c1: C.cyan, c2: C.emerald, fav: false },
  { id: 9, title: 'Glasshouse', artist: 'Aurora Lights', album: 'Glass Atlas', dur: 258, angle: 130, c1: C.accent, c2: C.violet, fav: false },
  { id: 10, title: 'Quiet Surface', artist: 'Lena Brandt', album: 'Northern Quiet', dur: 231, angle: 150, c1: C.violet, c2: C.cyan, fav: false },
  { id: 11, title: 'Late Reply', artist: 'The Hollowells', album: 'Field Notes', dur: 189, angle: 140, c1: C.pink, c2: C.accent, fav: false },
  { id: 12, title: 'Long Way Home', artist: 'Saoirse Quinn', album: 'Morning Acoustic', dur: 266, angle: 165, c1: C.amber, c2: C.emerald, fav: true },
];

const fmt = (s: number) => { s = Math.max(0, Math.round(s || 0)); const m = Math.floor(s / 60); const r = s % 60; return `${m}:${String(r).padStart(2, '0')}`; };

export function MediaPlayer() {
  const [q, setQ] = useState('');
  const [view, setView] = useState('library');
  const [playing, setPlaying] = useState(true);
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState(74);
  const [buffered, setBuffered] = useState(42);
  const [volume, setVolume] = useState(72);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [tracks, setTracks] = useState<Track[]>(SEED);

  const queue = tracks;
  const current = tracks[index] || ({} as Track);
  const pct = current.dur ? Math.min(100, (position / current.dur) * 100) : 0;

  const toggle = () => setPlaying((p) => !p);
  const play = (i: number) => { setIndex(i); setPosition(0); setBuffered(30); setPlaying(true); };
  const next = () => { setIndex((i) => (i + 1) % tracks.length); setPosition(0); setBuffered(30); setPlaying(true); };
  const prev = () => {
    if (position > 4) { setPosition(0); return; }
    setIndex((i) => (i - 1 + tracks.length) % tracks.length); setPosition(0); setBuffered(30);
  };
  const cycleRepeat = () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));
  const seekBy = (d: number) => setPosition((p) => Math.max(0, Math.min(current.dur || 0, p + d)));
  const scrub = (ev: React.MouseEvent<HTMLButtonElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    setPosition(Math.round(ratio * (current.dur || 0)));
    setBuffered((b) => Math.min(100, Math.max(b, ratio * 100 + 12)));
  };
  const toggleFav = (id: number) => setTracks((p) => p.map((t) => (t.id === id ? { ...t, fav: !t.fav } : t)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') seekBy(5);
      else if (e.key === 'ArrowLeft') seekBy(-5);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.dur]);

  return (
    <>
      <PageHead
        title="Media Player"
        subtitle="Your library — 248 tracks across 7 playlists, 18.4 hours of audio."
        actions={
          <>
            <div className="ax-input-group ax-input-group--pill" style={{ width: 260, maxWidth: '40vw' }}>
              <span className="ax-input-group__addon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
              </span>
              <input type="search" className="ax-input" placeholder="Search library" aria-label="Search library" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add media</span>
            </button>
          </>
        }
      />

      <div className="ax-mp">
        <aside className="ax-card ax-mp__rail" role="region" aria-label="Library navigation">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', height: '100%' }}>
            <nav aria-label="Library">
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {VIEWS.map((v) => (
                  <li key={v.id}>
                    <button type="button" className={`ax-mp__nav${view === v.id ? ' is-active' : ''}`} onClick={() => setView(v.id)}>
                      <span className="ax-mp__nav-ico" aria-hidden="true">{v.icon}</span>
                      <span className="ax-mp__nav-label">{v.label}</span>
                      <span className="ax-num ax-mp__nav-count">{v.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="ax-divider" role="separator" />

            <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <p className="ax-mp__rail-label">Playlists</p>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="New playlist">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                </button>
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                {PLAYLISTS.map((p) => (
                  <li key={p.id}>
                    <button type="button" className={`ax-mp__nav${view === p.id ? ' is-active' : ''}`} onClick={() => setView(p.id)}>
                      <span className="ax-mp__nav-dot" style={{ background: p.color }} aria-hidden="true" />
                      <span className="ax-mp__nav-label ax-truncate">{p.label}</span>
                      <span className="ax-num ax-mp__nav-count">{p.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ax-mp__device">
              <span className="ax-mp__device-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10" /><path d="M7 20h10" /><path d="M9 16v4" /><path d="M15 16v4" /></svg>
              </span>
              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                <div style={{ fontSize: 'var(--ax-text-xs)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Studio iMac</div>
                <div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>Playing on this device</div>
              </div>
              <span className="ax-mp__device-pulse" aria-hidden="true" />
            </div>
          </div>
        </aside>

        <div className="ax-mp__stage">
          <section className="ax-card ax-mp__now" role="region" aria-label="Now playing">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
              <div className="ax-mp__now-grid">
                <div className="ax-mp__cover" style={{ background: `linear-gradient(${current.angle}deg, ${current.c1}, ${current.c2})` }}>
                  <span className="ax-mp__cover-shine" aria-hidden="true" />
                  <svg className={`ax-mp__cover-glyph${playing ? ' is-spinning' : ''}`} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M13 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M9 17v-13h10v13" /><path d="M9 8h10" /></svg>
                  <span className="ax-mp__cover-badge ax-num" aria-hidden="true">FLAC · 24-bit</span>
                </div>

                <div className="ax-mp__now-main">
                  <div>
                    <span className="ax-card__eyebrow">{current.album}</span>
                    <h2 className="ax-mp__now-title">{current.title}</h2>
                    <p className="ax-mp__now-artist">{current.artist}</p>
                  </div>

                  <div className="ax-mp__scrub" role="group" aria-label="Seek">
                    <span className="ax-num ax-mp__time">{fmt(position)}</span>
                    <button type="button" className="ax-mp__bar" onClick={scrub} aria-label={`Seek. Elapsed ${fmt(position)} of ${fmt(current.dur)}`}>
                      <span className="ax-mp__bar-track">
                        <span className="ax-mp__bar-buffer" style={{ width: `${buffered}%` }} aria-hidden="true" />
                        <span className="ax-mp__bar-fill" style={{ width: `${pct}%` }} aria-hidden="true" />
                        <span className="ax-mp__bar-knob" style={{ left: `${pct}%` }} aria-hidden="true" />
                      </span>
                    </button>
                    <span className="ax-num ax-mp__time">-{fmt((current.dur || 0) - position)}</span>
                  </div>

                  <div className="ax-mp__transport">
                    <button type="button" className={`ax-mp__ctl${shuffle ? ' is-on' : ''}`} onClick={() => setShuffle((s) => !s)} aria-pressed={shuffle} aria-label="Shuffle">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 4l3 3l-3 3" /><path d="M18 20l3 -3l-3 -3" /><path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5" /><path d="M21 7h-5a4.978 4.978 0 0 0 -3 1m-4 8a4.984 4.984 0 0 1 -3 1h-3" /></svg>
                    </button>
                    <button type="button" className="ax-mp__ctl" onClick={prev} aria-label="Previous track">
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.496 4.136l-12 7a1 1 0 0 0 0 1.728l12 7a1 1 0 0 0 1.504 -.864v-14a1 1 0 0 0 -1.504 -.864z" /><path d="M4 4a1 1 0 0 1 .993 .883l.007 .117v14a1 1 0 0 1 -1.993 .117l-.007 -.117v-14a1 1 0 0 1 1 -1z" /></svg>
                    </button>
                    <button type="button" className="ax-mp__play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
                      {!playing ? (
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4v16a1 1 0 0 0 1.524 .852l13 -8a1 1 0 0 0 0 -1.704l-13 -8a1 1 0 0 0 -1.524 .852z" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" /><path d="M17 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" /></svg>
                      )}
                    </button>
                    <button type="button" className="ax-mp__ctl" onClick={next} aria-label="Next track">
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5v14a1 1 0 0 0 1.504 .864l12 -7a1 1 0 0 0 0 -1.728l-12 -7a1 1 0 0 0 -1.504 .864z" /><path d="M20 4a1 1 0 0 1 .993 .883l.007 .117v14a1 1 0 0 1 -1.993 .117l-.007 -.117v-14a1 1 0 0 1 1 -1z" /></svg>
                    </button>
                    <button type="button" className={`ax-mp__ctl${repeat !== 'off' ? ' is-on' : ''}`} onClick={cycleRepeat} aria-pressed={repeat !== 'off'} aria-label={`Repeat: ${repeat}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3" /><path d="M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3" /></svg>
                      {repeat === 'one' && <span className="ax-mp__ctl-badge ax-num" aria-hidden="true">1</span>}
                    </button>
                  </div>

                  <div className="ax-mp__sub">
                    <button type="button" className={`ax-mp__chip${current.fav ? ' is-fav' : ''}`} onClick={() => toggleFav(current.id)} aria-pressed={current.fav} aria-label={current.fav ? 'Remove from favorites' : 'Add to favorites'}>
                      <svg viewBox="0 0 24 24" fill={current.fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg>
                    </button>

                    <div className="ax-mp__vol">
                      <button type="button" className="ax-mp__chip" onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'}>
                        {!muted ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8a5 5 0 0 1 0 8" /><path d="M17.7 5a9 9 0 0 1 0 14" /><path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5" /></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8a5 5 0 0 1 1.912 4.934m-1.377 2.602a5 5 0 0 1 -.535 .464" /><path d="M9.069 5.054l.431 -.554a.8 .8 0 0 1 1.5 .5v2m0 4v8a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l1.294 -1.664" /><path d="M3 3l18 18" /></svg>
                        )}
                      </button>
                      <input type="range" className="ax-range--native ax-mp__vol-range" min={0} max={100} value={volume} onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }} aria-label="Volume" />
                      <span className="ax-num ax-mp__vol-val">{(muted ? 0 : volume)}%</span>
                    </div>

                    <span style={{ flex: '1 1 auto' }} />

                    <button type="button" className="ax-mp__chip" aria-label="Connect a device">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10" /><path d="M7 20h10" /><path d="M9 16v4" /><path d="M15 16v4" /></svg>
                    </button>
                    <button type="button" className="ax-mp__chip" aria-label="Open full screen">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 4l4 0l0 4" /><path d="M14 10l6 -6" /><path d="M8 20l-4 0l0 -4" /><path d="M4 20l6 -6" /><path d="M16 20l4 0l0 -4" /><path d="M14 14l6 6" /><path d="M8 4l-4 0l0 4" /><path d="M4 4l6 6" /></svg>
                    </button>
                  </div>

                  <div className={`ax-mp__viz${playing ? ' is-live' : ''}`} role="img" aria-label="Audio visualizer" aria-hidden="true">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
                      <span key={n} className="ax-mp__viz-bar" style={{ ['--ax-i' as string]: n }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="ax-card ax-mp__queue" role="region" aria-label="Up next queue">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Up next</span>
                <h3 className="ax-card__title">Focus Flow</h3>
                <p className="ax-card__subtitle"><span className="ax-num">{tracks.length}</span> tracks · 1 hr 14 min</p>
              </div>
              <div className="ax-card__actions">
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setShuffle((s) => !s)} aria-pressed={shuffle}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 4l3 3l-3 3" /><path d="M18 20l3 -3l-3 -3" /><path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5" /><path d="M21 7h-5a4.978 4.978 0 0 0 -3 1m-4 8a4.984 4.984 0 0 1 -3 1h-3" /></svg>
                  <span className="ax-btn__label">Shuffle</span>
                </button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Queue options">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
                </button>
              </div>
            </div>

            <ul className="ax-mp__list" role="list">
              {queue.map((t, i) => (
                <li key={t.id} className={`ax-mp__track${i === index ? ' is-active' : ''}`} onDoubleClick={() => play(i)}>
                  <span className="ax-mp__track-idx">
                    {i !== index && <span className="ax-num ax-mp__track-num">{String(i + 1).padStart(2, '0')}</span>}
                    {i === index && <span className={`ax-mp__eq${!playing ? ' is-paused' : ''}`} aria-hidden="true"><i /><i /><i /><i /></span>}
                    <button type="button" className="ax-mp__track-play" onClick={() => (i === index ? toggle() : play(i))} aria-label={i === index ? (playing ? 'Pause' : 'Play') : `Play ${t.title}`}>
                      {!(i === index && playing) ? (
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4v16a1 1 0 0 0 1.524 .852l13 -8a1 1 0 0 0 0 -1.704l-13 -8a1 1 0 0 0 -1.524 .852z" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" /><path d="M17 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" /></svg>
                      )}
                    </button>
                  </span>

                  <span className="ax-mp__track-art" style={{ background: `linear-gradient(${t.angle}deg, ${t.c1}, ${t.c2})` }} aria-hidden="true" />

                  <span className="ax-mp__track-meta">
                    <span className="ax-mp__track-title ax-truncate">{t.title}</span>
                    <span className="ax-mp__track-artist ax-truncate">{t.artist}</span>
                  </span>

                  <span className="ax-mp__track-album ax-truncate">{t.album}</span>

                  <button type="button" className={`ax-mp__track-fav${t.fav ? ' is-fav' : ''}`} onClick={() => toggleFav(t.id)} aria-pressed={t.fav} aria-label={t.fav ? `Unfavorite ${t.title}` : `Favorite ${t.title}`}>
                    <svg viewBox="0 0 24 24" fill={t.fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg>
                  </button>

                  <span className="ax-num ax-mp__track-dur">{fmt(t.dur)}</span>

                  <button type="button" className="ax-mp__track-more" aria-label="Track options">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
                  </button>
                </li>
              ))}
            </ul>

            <div className="ax-card__footer">
              <a className="ax-link" href="#">Open full queue
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: -2, marginInlineStart: 2 }}><path d="M5 12l14 0" /><path d="M13 18l6 -6l-6 -6" /></svg>
              </a>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .ax-mp { display:grid; grid-template-columns:248px minmax(0,1fr); gap:var(--ax-space-6); align-items:start; }
        @media (max-width:1100px){ .ax-mp { grid-template-columns:1fr; } }
        .ax-mp__rail { position:sticky; top:var(--ax-space-6); min-height:560px; }
        @media (max-width:1100px){ .ax-mp__rail { position:static; min-height:0; } }
        .ax-mp__rail-label { font-size:var(--ax-text-2xs); font-weight:var(--ax-weight-semibold); letter-spacing:.08em; text-transform:uppercase; color:var(--ax-text-subtle); }
        .ax-mp__nav { display:flex; align-items:center; gap:var(--ax-space-3); width:100%; padding:8px 10px; border:0; background:transparent; border-radius:var(--ax-radius-md); color:var(--ax-text-muted); cursor:pointer; text-align:start; transition:background var(--ax-motion-fast), color var(--ax-motion-fast); }
        .ax-mp__nav:hover { background:var(--ax-fill-hover); color:var(--ax-text-strong); }
        .ax-mp__nav.is-active { background:var(--ax-accent-wash); color:var(--ax-text-strong); box-shadow:inset 0 0 0 1px var(--ax-glass-hi); }
        .ax-mp__nav.is-active .ax-mp__nav-ico { color:var(--ax-accent); }
        .ax-mp__nav-ico { display:inline-flex; flex:0 0 auto; color:var(--ax-text-subtle); }
        .ax-mp__nav-ico svg { width:18px; height:18px; }
        .ax-mp__nav-dot { width:9px; height:9px; flex:0 0 auto; border-radius:3px; }
        .ax-mp__nav-label { flex:1 1 auto; min-width:0; font-size:var(--ax-text-sm); font-weight:var(--ax-weight-medium); }
        .ax-mp__nav-count { flex:0 0 auto; font-size:var(--ax-text-xs); color:var(--ax-text-subtle); }
        .ax-mp__device { display:flex; align-items:center; gap:var(--ax-space-3); padding:var(--ax-space-3); border-radius:var(--ax-radius-md); background:var(--ax-surface-subtle); border:1px solid var(--ax-border); }
        .ax-mp__device-ico { display:inline-flex; flex:0 0 auto; color:var(--ax-accent); }
        .ax-mp__device-pulse { width:8px; height:8px; flex:0 0 auto; border-radius:50%; background:var(--ax-accent); box-shadow:0 0 0 0 var(--ax-accent-wash); animation:ax-mp-pulse 2s var(--ax-ease-standard) infinite; }
        @keyframes ax-mp-pulse { 0%{ box-shadow:0 0 0 0 var(--ax-accent-wash); } 70%{ box-shadow:0 0 0 7px transparent; } 100%{ box-shadow:0 0 0 0 transparent; } }
        .ax-mp__stage { display:flex; flex-direction:column; gap:var(--ax-space-6); min-width:0; }
        .ax-mp__now-grid { display:grid; grid-template-columns:248px minmax(0,1fr); gap:var(--ax-space-6); align-items:start; }
        @media (max-width:760px){ .ax-mp__now-grid { grid-template-columns:1fr; } }
        .ax-mp__cover { position:relative; aspect-ratio:1/1; border-radius:var(--ax-radius-lg); overflow:hidden; box-shadow:var(--ax-shadow-md); display:flex; align-items:center; justify-content:center; }
        .ax-mp__cover-shine { position:absolute; inset:0; background:linear-gradient(135deg, rgba(255,255,255,.22), transparent 42%); pointer-events:none; }
        .ax-mp__cover-glyph { width:64px; height:64px; opacity:.92; }
        .ax-mp__cover-glyph.is-spinning { animation:ax-mp-spin 9s linear infinite; transform-origin:center; }
        @keyframes ax-mp-spin { to { transform:rotate(360deg); } }
        .ax-mp__cover-badge { position:absolute; left:var(--ax-space-3); bottom:var(--ax-space-3); padding:3px 8px; font-size:var(--ax-text-2xs); font-family:var(--ax-font-mono); letter-spacing:.04em; color:#fff; background:rgba(0,0,0,.34); border-radius:var(--ax-radius-pill); backdrop-filter:blur(6px); }
        .ax-mp__now-main { display:flex; flex-direction:column; gap:var(--ax-space-5); min-width:0; }
        .ax-mp__now-title { font-family:var(--ax-font-display); font-size:var(--ax-text-2xl); font-weight:700; line-height:1.1; letter-spacing:-.01em; color:var(--ax-text-strong); margin-top:4px; }
        .ax-mp__now-artist { font-size:var(--ax-text-md); color:var(--ax-text-muted); margin-top:4px; }
        .ax-mp__scrub { display:flex; align-items:center; gap:var(--ax-space-3); }
        .ax-mp__time { flex:0 0 auto; font-family:var(--ax-font-mono); font-size:var(--ax-text-xs); color:var(--ax-text-subtle); min-width:4ch; }
        .ax-mp__bar { flex:1 1 auto; border:0; background:transparent; padding:8px 0; cursor:pointer; display:block; }
        .ax-mp__bar-track { position:relative; display:block; height:5px; border-radius:var(--ax-radius-pill); background:var(--ax-fill-hover); overflow:visible; }
        .ax-mp__bar-buffer { position:absolute; inset-block:0; inset-inline-start:0; border-radius:inherit; background:var(--ax-border-strong); }
        .ax-mp__bar-fill { position:absolute; inset-block:0; inset-inline-start:0; border-radius:inherit; background:var(--ax-gradient-accent); }
        .ax-mp__bar-knob { position:absolute; top:50%; width:13px; height:13px; transform:translate(-50%,-50%); border-radius:50%; background:var(--ax-surface-solid); border:2px solid var(--ax-accent); box-shadow:var(--ax-shadow-sm); opacity:0; transition:opacity var(--ax-motion-fast); }
        .ax-mp__bar:hover .ax-mp__bar-knob, .ax-mp__bar:focus-visible .ax-mp__bar-knob { opacity:1; }
        .ax-mp__bar:focus-visible { outline:none; }
        .ax-mp__bar:focus-visible .ax-mp__bar-track { box-shadow:0 0 0 2px var(--ax-canvas), 0 0 0 4px var(--ax-focus-ring); }
        .ax-mp__transport { display:flex; align-items:center; justify-content:center; gap:var(--ax-space-3); }
        .ax-mp__ctl { position:relative; display:inline-flex; align-items:center; justify-content:center; width:42px; height:42px; border:0; border-radius:50%; background:transparent; color:var(--ax-text-muted); cursor:pointer; transition:background var(--ax-motion-fast), color var(--ax-motion-fast); }
        .ax-mp__ctl svg { width:22px; height:22px; }
        .ax-mp__ctl:hover { background:var(--ax-fill-hover); color:var(--ax-text-strong); }
        .ax-mp__ctl.is-on { color:var(--ax-accent); }
        .ax-mp__ctl-badge { position:absolute; top:6px; right:6px; min-width:13px; height:13px; padding:0 3px; display:inline-flex; align-items:center; justify-content:center; font-size:9px; font-family:var(--ax-font-mono); font-weight:600; color:var(--ax-on-accent); background:var(--ax-accent); border-radius:var(--ax-radius-pill); }
        .ax-mp__play { display:inline-flex; align-items:center; justify-content:center; width:58px; height:58px; flex:0 0 auto; border:0; border-radius:50%; background:var(--ax-gradient-accent); color:var(--ax-on-accent); cursor:pointer; box-shadow:0 12px 26px -10px rgba(var(--ax-accent-rgb),.75); transition:transform var(--ax-motion-fast); }
        .ax-mp__play:hover { transform:scale(1.04); }
        .ax-mp__play:active { transform:scale(.97); }
        .ax-mp__play svg { width:26px; height:26px; }
        .ax-mp__sub { display:flex; align-items:center; gap:var(--ax-space-2); flex-wrap:wrap; }
        .ax-mp__chip { display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; flex:0 0 auto; border:1px solid var(--ax-border); border-radius:var(--ax-radius-sm); background:var(--ax-surface-subtle); color:var(--ax-text-muted); cursor:pointer; transition:background var(--ax-motion-fast), color var(--ax-motion-fast), border-color var(--ax-motion-fast); }
        .ax-mp__chip svg { width:19px; height:19px; }
        .ax-mp__chip:hover { color:var(--ax-text-strong); border-color:var(--ax-border-strong); }
        .ax-mp__chip.is-fav { color:var(--ax-accent); border-color:var(--ax-accent); background:var(--ax-accent-wash); }
        .ax-mp__vol { display:flex; align-items:center; gap:var(--ax-space-2); }
        .ax-mp__vol-range { width:108px; }
        .ax-mp__vol-val { font-family:var(--ax-font-mono); font-size:var(--ax-text-xs); color:var(--ax-text-subtle); min-width:4ch; }
        .ax-mp__viz { display:flex; align-items:flex-end; gap:3px; height:36px; padding-top:var(--ax-space-2); }
        .ax-mp__viz-bar { flex:1 1 0; min-width:2px; height:18%; border-radius:var(--ax-radius-pill); background:color-mix(in oklab, var(--ax-accent) 38%, transparent); transition:height var(--ax-motion-fast); }
        .ax-mp__viz.is-live .ax-mp__viz-bar { background:var(--ax-accent); animation:ax-mp-eq 1100ms var(--ax-ease-standard) infinite; animation-delay:calc(var(--ax-i) * -70ms); }
        @keyframes ax-mp-eq { 0%,100%{ height:18%; } 20%{ height:88%; } 45%{ height:34%; } 65%{ height:100%; } 82%{ height:50%; } }
        .ax-mp__list { list-style:none; margin:0; padding:0; }
        .ax-mp__track { position:relative; display:grid; grid-template-columns:34px 40px minmax(0,1.6fr) minmax(0,1fr) 38px 5ch 32px; align-items:center; gap:var(--ax-space-3); padding:8px var(--ax-space-5); border-top:1px solid var(--ax-border); transition:background var(--ax-motion-fast); }
        .ax-mp__track:first-child { border-top:0; }
        .ax-mp__track:hover { background:var(--ax-fill-hover); }
        .ax-mp__track.is-active { background:var(--ax-accent-wash); }
        .ax-mp__track.is-active::before { content:""; position:absolute; inset-inline-start:0; inset-block:6px; width:2px; border-radius:var(--ax-radius-pill); background:var(--ax-accent); }
        .ax-mp__track-idx { position:relative; display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; }
        .ax-mp__track-num { font-family:var(--ax-font-mono); font-size:var(--ax-text-xs); color:var(--ax-text-subtle); }
        .ax-mp__track.is-active .ax-mp__track-num { color:var(--ax-accent); }
        .ax-mp__track-play { position:absolute; inset:0; display:none; align-items:center; justify-content:center; border:0; background:transparent; color:var(--ax-text-strong); cursor:pointer; }
        .ax-mp__track-play svg { width:16px; height:16px; }
        .ax-mp__track:hover .ax-mp__track-num { display:none; }
        .ax-mp__track:hover .ax-mp__eq { display:none; }
        .ax-mp__track:hover .ax-mp__track-play { display:inline-flex; }
        .ax-mp__track.is-active .ax-mp__track-play { color:var(--ax-accent); }
        .ax-mp__eq { display:inline-flex; align-items:flex-end; gap:2px; height:15px; }
        .ax-mp__eq i { width:2.5px; border-radius:1px; background:var(--ax-accent); animation:ax-mp-eqbar 900ms var(--ax-ease-standard) infinite; }
        .ax-mp__eq i:nth-child(1){ height:40%; animation-delay:-200ms; }
        .ax-mp__eq i:nth-child(2){ height:90%; animation-delay:-400ms; }
        .ax-mp__eq i:nth-child(3){ height:55%; animation-delay:-100ms; }
        .ax-mp__eq i:nth-child(4){ height:75%; animation-delay:-300ms; }
        .ax-mp__eq.is-paused i { animation-play-state:paused; }
        @keyframes ax-mp-eqbar { 0%,100%{ height:30%; } 50%{ height:100%; } }
        .ax-mp__track-art { width:40px; height:40px; flex:0 0 auto; border-radius:var(--ax-radius-sm); position:relative; overflow:hidden; }
        .ax-mp__track-art::after { content:""; position:absolute; inset:0; background:linear-gradient(135deg, rgba(255,255,255,.18), transparent 50%); }
        .ax-mp__track-meta { min-width:0; display:flex; flex-direction:column; }
        .ax-mp__track-title { font-size:var(--ax-text-sm); font-weight:var(--ax-weight-medium); color:var(--ax-text-strong); }
        .ax-mp__track.is-active .ax-mp__track-title { color:var(--ax-accent); }
        .ax-mp__track-artist { font-size:var(--ax-text-xs); color:var(--ax-text-subtle); }
        .ax-mp__track-album { font-size:var(--ax-text-sm); color:var(--ax-text-muted); }
        .ax-mp__track-fav { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border:0; background:transparent; color:var(--ax-text-subtle); cursor:pointer; opacity:0; transition:opacity var(--ax-motion-fast), color var(--ax-motion-fast); }
        .ax-mp__track-fav svg { width:17px; height:17px; }
        .ax-mp__track:hover .ax-mp__track-fav, .ax-mp__track-fav.is-fav { opacity:1; }
        .ax-mp__track-fav:hover { color:var(--ax-text-strong); }
        .ax-mp__track-fav.is-fav { color:var(--ax-accent); }
        .ax-mp__track-dur { font-family:var(--ax-font-mono); font-size:var(--ax-text-xs); color:var(--ax-text-muted); text-align:end; }
        .ax-mp__track-more { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border:0; background:transparent; color:var(--ax-text-subtle); cursor:pointer; opacity:0; transition:opacity var(--ax-motion-fast), color var(--ax-motion-fast); }
        .ax-mp__track-more svg { width:18px; height:18px; }
        .ax-mp__track:hover .ax-mp__track-more { opacity:1; }
        .ax-mp__track-more:hover { color:var(--ax-text-strong); }
        @media (max-width:680px){
          .ax-mp__track { grid-template-columns:34px 40px minmax(0,1fr) 5ch 32px; }
          .ax-mp__track-album { display:none; }
          .ax-mp__track-fav { display:none; }
        }
        @media (prefers-reduced-motion: reduce){
          .ax-mp__cover-glyph.is-spinning, .ax-mp__device-pulse, .ax-mp__viz-bar, .ax-mp__eq i { animation:none !important; }
          .ax-mp__viz.is-live .ax-mp__viz-bar { height:52%; }
        }
      `}</style>
    </>
  );
}

export default MediaPlayer;
