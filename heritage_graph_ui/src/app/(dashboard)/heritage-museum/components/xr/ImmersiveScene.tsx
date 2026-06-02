'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { NODE_TYPE_CONFIG, type GraphNode } from '../../heritage-data';
import { buildBeats } from '../../utils/storyBeats';
import { ImageAttribution } from '../ImageAttribution';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

const PanoramaViewer = dynamic(() => import('./PanoramaViewer').then((m) => m.PanoramaViewer), { ssr: false });

// ── CSS keyframes needed by this component ───────────────────────────────────
const XR_STYLES = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes kenBurns {
    from { transform: scale(1)   translate(0, 0); }
    to   { transform: scale(1.1) translate(-2%, -1%); }
  }
`;

// ── Storytelling overlay ──────────────────────────────────────────────────────
const BEAT_MS = 10_000;

function StorytellingOverlay({
  node,
  cfg,
  reducedMotion,
}: {
  node: GraphNode;
  cfg: (typeof NODE_TYPE_CONFIG)[keyof typeof NODE_TYPE_CONFIG];
  reducedMotion: boolean;
}) {
  const beats = useMemo(() => buildBeats(node), [node]);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const pausedProgressRef = useRef(0);

  useEffect(() => {
    setIdx(0); setProgress(0);
    // When reduced motion is requested, render immediately (no fade-in delay).
    setVisible(reducedMotion);
    if (reducedMotion) return;
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, [node.id, reducedMotion]);

  useEffect(() => {
    // Respect prefers-reduced-motion: never auto-advance; the reader steps
    // through beats manually via Prev/Next or the dot navigation.
    if (reducedMotion || paused) { pausedProgressRef.current = progress; return; }
    const startProg = pausedProgressRef.current || progress;
    startRef.current = performance.now() - (startProg / 100) * BEAT_MS;
    const tick = (now: number) => {
      const p = Math.min(100, ((now - startRef.current) / BEAT_MS) * 100);
      setProgress(p);
      if (p >= 100) {
        setIdx((i) => (i + 1) % beats.length);
        setProgress(0); pausedProgressRef.current = 0;
        startRef.current = performance.now();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, idx, beats.length, reducedMotion]);

  const go = useCallback((next: number) => {
    setIdx(next); setProgress(0);
    pausedProgressRef.current = 0; startRef.current = performance.now();
  }, []);

  const beat = beats[idx];
  const isBullet = beat.lines.length > 1;

  return (
    <div
      className="w-[42%] flex flex-col justify-center py-8 pr-8 pl-4"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(24px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="relative rounded-2xl border overflow-hidden"
        style={{
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(20px)',
          borderColor: `${cfg.color}44`,
          boxShadow: `0 0 60px ${cfg.color}18, inset 0 0 0 1px rgba(255,255,255,0.06)`,
        }}
      >
        {/* Progress bar */}
        <div className="h-0.5 w-full bg-white/5">
          <div
            className="h-full"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(to right, ${cfg.color}, ${cfg.glowColor})`,
              transition: paused ? 'none' : 'width 0.1s linear',
            }}
          />
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full"
                style={{ background: `${cfg.color}33`, color: cfg.glowColor }}
              >
                {beat.icon} {beat.title}
              </span>
              {paused && (
                <span className="text-xs text-gray-600 border border-white/10 px-2 py-0.5 rounded-full">⏸ paused</span>
              )}
            </div>
            <span className="text-xs text-gray-600 tabular-nums">{idx + 1} / {beats.length}</span>
          </div>

          <div
            key={`${node.id}-${idx}`}
            style={{ animation: reducedMotion ? 'none' : 'fadeInUp 0.4s ease both' }}
            aria-live="polite"
          >
            {isBullet ? (
              <ul className="space-y-2">
                {beat.lines.map((line, i) => {
                  const [label, value] = line.includes('  ·  ') ? line.split('  ·  ') : [null, line];
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {label ? (
                        <>
                          <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                          <span className="text-gray-400 w-28 shrink-0 truncate">{label}</span>
                          <span className="text-gray-100 font-medium">{value}</span>
                        </>
                      ) : (
                        <>
                          <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: cfg.glowColor }} />
                          <span className="text-gray-200 leading-relaxed">{line}</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-200 text-sm leading-7">{beat.lines[0]}</p>
            )}
          </div>

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.08]">
            <button
              onClick={() => go(Math.max(0, idx - 1))}
              disabled={idx === 0}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-white/30 disabled:opacity-25 transition-all"
            >← Prev</button>

            <div className="flex items-center gap-1 flex-wrap justify-center max-w-[160px]">
              {beats.map((b, i) => (
                <button
                  key={i} onClick={() => go(i)} title={b.title}
                  className="rounded-full transition-all hover:scale-125"
                  style={{ width: i === idx ? 16 : 6, height: 6, background: i === idx ? cfg.color : 'rgba(255,255,255,0.2)' }}
                />
              ))}
            </div>

            <button
              onClick={() => go(Math.min(beats.length - 1, idx + 1))}
              disabled={idx === beats.length - 1}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-white/30 disabled:opacity-25 transition-all"
            >Next →</button>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-700 mt-3 text-center">
        {reducedMotion
          ? 'Use ← Prev / Next → or the dots to step through the story'
          : 'Hover to pause · Click dots to jump · auto-advances every 10s'}
      </p>
    </div>
  );
}

// ── Floating key-fact badges ──────────────────────────────────────────────────
function KeyFactBadges({
  node,
  cfg,
}: {
  node: GraphNode;
  cfg: (typeof NODE_TYPE_CONFIG)[keyof typeof NODE_TYPE_CONFIG];
}) {
  if (!node.keyFacts?.length) return null;
  return (
    <div className="absolute top-5 right-5 flex flex-col items-end gap-2 z-10 pointer-events-none">
      {node.keyFacts.slice(0, 4).map((f, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs backdrop-blur-md border"
          style={{
            background: 'rgba(0,0,0,0.5)', borderColor: `${cfg.color}44`,
            animation: `fadeInUp 0.4s ease ${i * 0.1}s both`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
          <span className="text-gray-400">{f.label}</span>
          <span className="text-gray-100 font-semibold">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Narration hook ─────────────────────────────────────────────────────────────
function useNarration(text: string) {
  const [playing, setPlaying] = useState(false);
  const play = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9; u.pitch = 1; u.lang = 'en-GB';
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((v) => v.lang.startsWith('en-GB')) ?? null;
    if (v) u.voice = v;
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(u);
    setPlaying(true);
  }, [text]);
  const stop = useCallback(() => { window.speechSynthesis?.cancel(); setPlaying(false); }, []);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, [text]);
  return { playing, play, stop };
}

// ── Gallery card ───────────────────────────────────────────────────────────────
function GalleryCard({ node, onSelect }: { node: GraphNode; onSelect: (n: GraphNode) => void }) {
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  return (
    <button
      onClick={() => onSelect(node)}
      className="relative group overflow-hidden rounded-2xl border border-white/10 hover:border-white/30 transition-all hover:scale-[1.03] focus:outline-none"
      style={{ aspectRatio: '4/3' }}
    >
      <div
        className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
        style={{
          background: node.imageUrl
            ? `url(${node.imageUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${cfg.color}44 0%, #0f172a 100%)`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ background: `${cfg.color}cc` }}>
        {cfg.emoji}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-semibold text-sm leading-tight">{node.label}</p>
        <p className="text-xs mt-0.5 font-medium" style={{ color: cfg.glowColor }}>{cfg.label}</p>
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full border border-white/30">Explore →</span>
      </div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface ImmersiveSceneProps {
  node: GraphNode | null;
  allNodes: GraphNode[];
  onSelect: (node: GraphNode) => void;
}

export function ImmersiveScene({ node, allNodes, onSelect }: ImmersiveSceneProps) {
  const [heroIdx, setHeroIdx] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showPanorama, setShowPanorama] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { playing, play, stop } = useNarration(node?.storyText ?? '');

  const images: string[] = node
    ? node.images?.length ? node.images : node.imageUrl ? [node.imageUrl] : []
    : [];

  useEffect(() => { setHeroIdx(0); setImgLoaded(false); }, [node?.id]);
  useEffect(() => { setImgLoaded(false); }, [heroIdx]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (reducedMotion) return; // no parallax drift when reduced motion is requested
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setParallax({
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 18,
      y: ((e.clientY - rect.top) / rect.height - 0.5) * 12,
    });
  }, [reducedMotion]);
  const handleMouseLeave = useCallback(() => setParallax({ x: 0, y: 0 }), []);

  // ── Gallery (no node selected) ──────────────────────────────────────────────
  if (!node) {
    return (
      <>
        <style>{XR_STYLES}</style>
        <div className="w-full h-full overflow-y-auto bg-gray-950 p-6">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8 text-center">
              <p className="text-3xl font-bold text-white mb-2">Choose a Place</p>
              <p className="text-gray-400 text-sm">Select any heritage site to enter its immersive story</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {allNodes.map((n) => <GalleryCard key={n.id} node={n} onSelect={onSelect} />)}
            </div>
          </div>
        </div>
      </>
    );
  }

  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const heroImage = images[heroIdx] ?? null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <style>{XR_STYLES}</style>

      {/* Hero background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 40% 40%, ${cfg.color}33 0%, #000814 70%)` }} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[22rem] opacity-5 select-none" style={{ filter: `drop-shadow(0 0 80px ${cfg.color})` }}>
            {cfg.emoji}
          </span>
        </div>
        {heroImage && (
          <div className="absolute inset-[-5%]" style={{ transform: `translate(${parallax.x}px, ${parallax.y}px)`, transition: 'transform 0.15s ease-out' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={heroImage} src={heroImage} alt={node.label}
              className="w-full h-full object-cover"
              style={{
                opacity: imgLoaded ? 1 : 0, transition: 'opacity 1.2s ease',
                animation: imgLoaded && !reducedMotion ? 'kenBurns 30s ease-in-out infinite alternate' : 'none',
              }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(false)}
            />
          </div>
        )}
      </div>

      {/* Cinematic overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/15 to-black/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20 pointer-events-none" />

      <KeyFactBadges node={node} cfg={cfg} />

      {/* Main content */}
      <div className="relative z-10 h-full flex flex-col">
        <div className="flex flex-1 min-h-0">

          {/* Left: identity + controls */}
          <div className="flex flex-col justify-end w-[58%] p-8 pb-6 gap-3">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full"
                style={{ background: `${cfg.color}44`, color: cfg.glowColor }}
              >
                {cfg.emoji} {cfg.label}
              </span>
              {node.unescoStatus && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-900/50 border border-blue-400/40 text-blue-300">UNESCO ✦</span>
              )}
            </div>

            <h2
              className="text-white font-extrabold leading-none"
              style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', textShadow: `0 0 40px ${cfg.color}88`, animation: 'fadeInUp 0.8s ease both' }}
            >
              {node.label}
            </h2>

            <div className="flex flex-wrap gap-2">
              {node.religion     && <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-gray-300">🕉 {node.religion}</span>}
              {node.inceptionYear && <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-gray-300">📅 c. {node.inceptionYear} CE</span>}
              {node.dynasty      && <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-gray-300">👑 {node.dynasty}</span>}
            </div>

            {node.lat && node.long && (
              <div className="text-xs text-gray-500">
                📍 {parseFloat(node.lat).toFixed(3)}°N, {parseFloat(node.long).toFixed(3)}°E ·{' '}
                <a href={`https://www.openstreetmap.org/?mlat=${node.lat}&mlon=${node.long}&zoom=15`}
                  target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  Open map ↗
                </a>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={playing ? stop : play}
                aria-pressed={playing}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                style={{ background: playing ? '#991b1b' : `${cfg.color}dd`, color: '#fff', boxShadow: `0 0 20px ${cfg.color}55` }}
              >
                {playing ? '⏹ Stop' : '▶ Narrate'}
              </button>
              {node.storyText && (
                <button
                  onClick={() => setShowTranscript((v) => !v)}
                  aria-expanded={showTranscript}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-white/20 bg-white/5 text-gray-200 hover:bg-white/10 transition-all"
                >
                  {showTranscript ? '▾ Hide transcript' : '☰ Transcript'}
                </button>
              )}
              {heroImage && (
                <button
                  onClick={() => setShowPanorama(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-purple-400/60 bg-purple-900/40 text-purple-200 hover:bg-purple-700/60 transition-all hover:scale-105"
                >
                  ◈ Immersive View
                </button>
              )}
            </div>

            {/* Narration transcript — text alternative for the spoken audio (WCAG 1.2) */}
            {showTranscript && node.storyText && (
              <div
                className="mt-1 max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/50 backdrop-blur-md p-4 text-sm leading-7 text-gray-200"
                style={{ scrollbarWidth: 'thin' }}
              >
                {node.storyText}
              </div>
            )}
          </div>

          {/* Right: storytelling overlay (auto-advances unless reduced motion) */}
          <StorytellingOverlay node={node} cfg={cfg} reducedMotion={reducedMotion} />
        </div>

        {/* Image filmstrip */}
        {images.length > 1 && (
          <div className="flex-shrink-0 px-6 pb-4">
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIdx(i)}
                  className="flex-shrink-0 relative overflow-hidden rounded-lg border-2 transition-all hover:scale-105"
                  style={{
                    width: 80, height: 56,
                    borderColor: i === heroIdx ? cfg.glowColor : 'transparent',
                    boxShadow: i === heroIdx ? `0 0 12px ${cfg.color}` : 'none',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  {i === heroIdx && <div className="absolute inset-0 rounded-md" style={{ background: `${cfg.color}33` }} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hero image attribution / license */}
      {heroImage && node.imageCredits?.[heroImage] && (
        <div className="absolute bottom-2 right-3 z-10 max-w-[45%] text-right">
          <ImageAttribution credit={node.imageCredits[heroImage]} />
        </div>
      )}

      {/* Panorama modal */}
      {showPanorama && heroImage && (
        <PanoramaViewer imageUrl={heroImage} node={node} reducedMotion={reducedMotion} onClose={() => setShowPanorama(false)} />
      )}
    </div>
  );
}
