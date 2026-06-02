'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { NODE_TYPE_CONFIG, type GraphNode } from '../../heritage-data';
import { buildBeats } from '../../utils/storyBeats';
import { ImageAttribution } from '../ImageAttribution';

interface PanoramaViewerProps {
  imageUrl: string;
  node: GraphNode;
  reducedMotion?: boolean;
  onClose: () => void;
}

// An equirectangular (true 360°) panorama has a 2:1 width:height ratio. Anything
// else is a standard photograph; wrapping it on a sphere is an immersive *effect*,
// not a real 360° capture, and we must say so rather than imply VR-grade fidelity.
function isEquirectangular(width: number, height: number): boolean {
  if (!width || !height) return false;
  return Math.abs(width / height - 2) <= 0.15;
}

// ── Narration ─────────────────────────────────────────────────────────────────
function useNarration(text: string) {
  const [playing, setPlaying] = useState(false);
  const play = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.88; u.pitch = 1; u.lang = 'en-GB';
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

// ── Story overlay inside panorama ─────────────────────────────────────────────
const BEAT_MS = 9_000;

function PanoramaStory({ node }: { node: GraphNode }) {
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const beats = useMemo(() => buildBeats(node), [node]);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { playing, play, stop } = useNarration(node.storyText);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const pausedProgRef = useRef(0);

  useEffect(() => {
    if (paused) { pausedProgRef.current = progress; return; }
    const startProg = pausedProgRef.current || progress;
    startRef.current = performance.now() - (startProg / 100) * BEAT_MS;
    const tick = (now: number) => {
      const p = Math.min(100, ((now - startRef.current) / BEAT_MS) * 100);
      setProgress(p);
      if (p >= 100) {
        setIdx((i) => (i + 1) % beats.length);
        setProgress(0); pausedProgRef.current = 0;
        startRef.current = performance.now();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, idx, beats.length]);

  const go = useCallback((i: number) => {
    setIdx(i); setProgress(0); pausedProgRef.current = 0; startRef.current = performance.now();
  }, []);

  const beat = beats[idx];
  const isBullet = beat.lines.length > 1;

  return (
    <div className="absolute bottom-6 left-6 z-20 w-[420px] max-w-[calc(100vw-3rem)]">
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold backdrop-blur-md border border-white/20 bg-black/60 text-white hover:bg-black/80 transition-all"
          style={{ boxShadow: `0 0 20px ${cfg.color}33` }}
        >
          <span style={{ color: cfg.glowColor }}>{beat.icon}</span>
          {beat.title}
          <span className="ml-auto text-gray-500">expand ↑</span>
        </button>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(24px)',
            borderColor: `${cfg.color}55`,
            boxShadow: `0 8px 60px rgba(0,0,0,0.6), 0 0 40px ${cfg.color}22`,
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="h-0.5 bg-white/5">
            <div className="h-full" style={{ width: `${progress}%`, background: `linear-gradient(to right, ${cfg.color}, ${cfg.glowColor})` }} />
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: `${cfg.color}33`, color: cfg.glowColor }}>
                {beat.icon} {beat.title}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 tabular-nums">{idx + 1}/{beats.length}</span>
                {paused && <span className="text-xs text-gray-600 border border-white/10 px-1.5 py-0.5 rounded-full">⏸</span>}
                <button onClick={() => setCollapsed(true)} className="text-gray-600 hover:text-white transition-colors text-xs px-1" title="Minimise">↓</button>
              </div>
            </div>

            <div key={`${node.id}-${idx}`} style={{ animation: 'fadeInUp 0.35s ease both' }}>
              {isBullet ? (
                <ul className="space-y-1.5">
                  {beat.lines.map((line, i) => {
                    const parts = line.split('  ·  ');
                    const [label, value] = parts.length === 2 ? parts : [null, line];
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                        {label ? (
                          <>
                            <span className="text-gray-500 w-24 shrink-0 truncate">{label}</span>
                            <span className="text-gray-100 font-medium">{value}</span>
                          </>
                        ) : (
                          <span className="text-gray-200 leading-relaxed">{line}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-gray-200 text-sm leading-7">{beat.lines[0]}</p>
              )}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.08]">
              <button onClick={() => go(Math.max(0, idx - 1))} disabled={idx === 0}
                className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-white/30 disabled:opacity-25 transition-all">
                ← Prev
              </button>
              <div className="flex items-center gap-1 flex-wrap justify-center max-w-[140px]">
                {beats.map((b, i) => (
                  <button key={i} onClick={() => go(i)} title={b.title}
                    className="rounded-full transition-all hover:scale-125"
                    style={{ width: i === idx ? 14 : 5, height: 5, background: i === idx ? cfg.color : 'rgba(255,255,255,0.2)' }}
                  />
                ))}
              </div>
              <button onClick={() => go(Math.min(beats.length - 1, idx + 1))} disabled={idx === beats.length - 1}
                className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-white/30 disabled:opacity-25 transition-all">
                Next →
              </button>
            </div>

            <button
              onClick={playing ? stop : play}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95"
              style={{
                background: playing ? '#7f1d1d' : `${cfg.color}33`,
                color: playing ? '#fca5a5' : cfg.glowColor,
                border: `1px solid ${cfg.color}44`,
              }}
            >
              {playing ? '⏹ Stop Narration' : '▶ Narrate Full Story'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Key-fact badges ───────────────────────────────────────────────────────────
function PanoramaFacts({ node }: { node: GraphNode }) {
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  if (!node.keyFacts?.length) return null;
  return (
    <div className="absolute top-20 right-5 z-20 flex flex-col items-end gap-2 pointer-events-none">
      {node.keyFacts.slice(0, 4).map((f, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs backdrop-blur-md border"
          style={{
            background: 'rgba(0,0,0,0.65)', borderColor: `${cfg.color}55`,
            animation: `fadeInUp 0.4s ease ${i * 0.08}s both`,
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
          <span className="text-gray-400">{f.label}</span>
          <span className="text-gray-100 font-semibold">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PanoramaViewer({ imageUrl, node, reducedMotion = false, onClose }: PanoramaViewerProps) {
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const mountRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [vrSupported, setVrSupported] = useState(false);
  const [arSupported, setArSupported] = useState(false);
  const [xrActive, setXrActive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // null = unknown until the texture loads; then true/false from its dimensions.
  const [equirect, setEquirect] = useState<boolean | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Close on Escape and move focus to the close button when the dialog opens.
  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const W = container.clientWidth, H = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 2000);
    camera.position.set(0, 0, 0.01);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const geo = new THREE.SphereGeometry(500, 60, 40);
    geo.scale(-1, 1, 1);
    const tex = new THREE.TextureLoader().load(imageUrl, (loadedTex) => {
      setLoaded(true);
      const img = loadedTex.image as { width?: number; height?: number } | undefined;
      if (img?.width && img?.height) setEquirect(isEquirectangular(img.width, img.height));
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    const sphere = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
    scene.add(sphere);

    // Auto-rotate only when motion is allowed; never fight a reduced-motion request.
    let lon = 0, lat = 0, isDragging = false, prevX = 0, prevY = 0, autoRotate = !reducedMotion;
    const AUTO_SPEED = 0.05;
    const toRad = (d: number) => (d * Math.PI) / 180;

    function updateCamera() {
      lat = Math.max(-85, Math.min(85, lat));
      const phi = toRad(90 - lat), theta = toRad(lon);
      camera.lookAt(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
    }

    const canvas = renderer.domElement;
    const onMouseDown = (e: MouseEvent) => { isDragging = true; autoRotate = false; prevX = e.clientX; prevY = e.clientY; };
    const onMouseMove = (e: MouseEvent) => { if (!isDragging) return; lon -= (e.clientX - prevX) * 0.25; lat += (e.clientY - prevY) * 0.25; prevX = e.clientX; prevY = e.clientY; };
    const onMouseUp = () => { isDragging = false; };
    let lastTX = 0, lastTY = 0;
    const onTouchStart = (e: TouchEvent) => { isDragging = true; autoRotate = false; lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); if (!isDragging) return; lon -= (e.touches[0].clientX - lastTX) * 0.3; lat += (e.touches[0].clientY - lastTY) * 0.3; lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY; };
    const onTouchEnd = () => { isDragging = false; };
    const onWheel = (e: WheelEvent) => { camera.fov = Math.max(20, Math.min(100, camera.fov + e.deltaY * 0.03)); camera.updateProjectionMatrix(); };
    const onResize = () => { const w = container.clientWidth, h = container.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); };
    // Keyboard look — arrow keys pan, +/- zoom. Lets the view be explored without
    // a pointer drag (WCAG 2.1 Keyboard). Ignored while typing in a field.
    const onKeyLook = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const STEP = 6;
      switch (e.key) {
        case 'ArrowLeft':  lon -= STEP; autoRotate = false; break;
        case 'ArrowRight': lon += STEP; autoRotate = false; break;
        case 'ArrowUp':    lat += STEP; autoRotate = false; break;
        case 'ArrowDown':  lat -= STEP; autoRotate = false; break;
        case '+': case '=': camera.fov = Math.max(20, camera.fov - 4); camera.updateProjectionMatrix(); break;
        case '-': case '_': camera.fov = Math.min(100, camera.fov + 4); camera.updateProjectionMatrix(); break;
        default: return;
      }
      e.preventDefault();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyLook);

    renderer.setAnimationLoop(() => { if (autoRotate && !isDragging) lon += AUTO_SPEED; updateCamera(); renderer.render(scene, camera); });

    if ('xr' in navigator && navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(setVrSupported).catch(() => {});
      navigator.xr.isSessionSupported('immersive-ar').then(setArSupported).catch(() => {});
    }

    return () => {
      renderer.setAnimationLoop(null);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyLook);
      renderer.dispose();
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, reducedMotion]);

  const enterVR = useCallback(async () => {
    const r = rendererRef.current; if (!r || !navigator.xr) return;
    try {
      const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      await r.xr.setSession(s); setXrActive(true);
      s.addEventListener('end', () => setXrActive(false));
    } catch (e) { console.warn('VR failed', e); }
  }, []);

  const enterAR = useCallback(async () => {
    const r = rendererRef.current; if (!r || !navigator.xr) return;
    try {
      const s = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'] });
      await r.xr.setSession(s); setXrActive(true);
      s.addEventListener('end', () => setXrActive(false));
    } catch (e) { console.warn('AR failed', e); }
  }, []);

  const exitXR = useCallback(async () => {
    const s = rendererRef.current?.xr.getSession(); if (s) await s.end();
  }, []);

  // Honest description of what is actually on screen, driven by image dimensions.
  const subtitle = !loaded
    ? 'Loading image…'
    : equirect === false
      ? 'Standard photograph in an immersive viewer — not a true 360° capture'
      : 'Drag or use arrow keys to look around · scroll or +/- to zoom';

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Immersive view of ${node.label}`}
    >
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Three.js canvas */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Top toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <button ref={closeBtnRef} onClick={onClose} aria-label="Close immersive view" className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all">✕</button>
          <div>
            <p className="text-white font-semibold text-sm flex items-center gap-2">
              <span style={{ color: cfg.glowColor }}>{cfg.emoji}</span>
              {node.label}
              {equirect === true && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/50 border border-emerald-400/40 text-emerald-300">360°</span>}
              {node.unescoStatus && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 border border-blue-400/40 text-blue-300">UNESCO</span>}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {!xrActive ? (
            <>
              {vrSupported && (
                <button onClick={enterVR} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-purple-400/60 bg-purple-900/60 text-purple-200 hover:bg-purple-600/70 transition-all">
                  ◈ Enter VR
                </button>
              )}
              {arSupported && (
                <button onClick={enterAR} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-cyan-400/60 bg-cyan-900/60 text-cyan-200 hover:bg-cyan-600/70 transition-all">
                  ◉ Enter AR
                </button>
              )}
              {!vrSupported && !arSupported && (
                <span className="text-xs text-gray-600 border border-white/10 px-3 py-1.5 rounded-full">WebXR not detected</span>
              )}
            </>
          ) : (
            <button onClick={exitXR} className="px-4 py-2 rounded-full text-xs font-semibold border border-red-400/60 bg-red-900/60 text-red-200 hover:bg-red-700/70 transition-all">
              ✕ Exit XR
            </button>
          )}
        </div>
      </div>

      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${cfg.color}66`, borderTopColor: cfg.color }} />
            <p className="text-gray-400 text-sm">Loading {node.label}…</p>
          </div>
        </div>
      )}

      <PanoramaFacts node={node} />
      <PanoramaStory node={node} />

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none max-w-[90vw]">
        <p className="text-xs text-white/40 bg-black/40 backdrop-blur-sm rounded-full px-4 py-1 text-center">
          {equirect === true
            ? 'True 360° equirectangular panorama'
            : equirect === false
              ? 'This is a standard photograph projected onto a sphere for immersive viewing — it is not a 360° capture'
              : 'Preparing immersive view…'}
        </p>
      </div>

      {/* Image attribution / license (pointer-events-auto so links are clickable) */}
      <div className="absolute bottom-2 right-3 z-10 max-w-[40vw] text-right pointer-events-auto">
        <ImageAttribution credit={node.imageCredits?.[imageUrl]} />
      </div>
    </div>
  );
}
