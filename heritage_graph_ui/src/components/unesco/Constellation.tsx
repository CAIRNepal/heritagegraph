'use client';

/**
 * The seven monument zones as a living graph.
 *
 * WHY A GRAPH AND NOT A GRID
 * The product's whole thesis is that heritage is connected — a temple, the
 * guthi that maintains it, the festival it hosts. A row of cards says the
 * opposite. This shows the zones as nodes on filaments so the idea lands before
 * a word of it is read.
 *
 * The connections drawn here are honest: all seven are components of the same
 * World Heritage property, so an edge between any two asserts nothing false.
 * No edge is labelled, because the point is curiosity, not a data dump — the
 * real, sourced relations live in the museum.
 *
 * WHY CANVAS AND NOT THREE.JS
 * three.js is already a dependency, but it is ~600kB and this sits above the
 * fold on a page with a 2.5s LCP budget. A perspective projection over canvas
 * 2D — project, depth-sort, draw — costs nothing and gives the same read.
 *
 * ACCESSIBILITY
 * The canvas is decorative and hidden from assistive technology; the same seven
 * zones are listed as real links immediately below it, which is the path for
 * keyboard and screen-reader users. Under `prefers-reduced-motion` the scene
 * renders one static frame instead of animating. Nothing here is the only way
 * to reach anything.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'framer-motion';

import { KATHMANDU_VALLEY } from '@/lib/unesco/ground-truth';
import { imageryFor } from '@/lib/unesco/imagery';
import { museumHref } from '@/lib/unesco/graph-bindings';
import { cn } from '@/lib/utils';

interface Node3D {
  key: string;
  label: string;
  href: string;
  x: number;
  y: number;
  z: number;
  img: HTMLImageElement | null;
  /** Projected each frame. */
  px: number;
  py: number;
  pr: number;
  scale: number;
}

/**
 * Loose 3-D placement. Deliberately not a neat circle — an even ring reads as
 * a loading spinner. Values are unit-ish and scaled to the canvas at runtime.
 */
const LAYOUT: Array<{ x: number; y: number; z: number }> = [
  { x: -0.62, y: -0.30, z: 0.35 },
  { x: 0.05, y: -0.52, z: -0.25 },
  { x: 0.68, y: -0.22, z: 0.20 },
  { x: -0.78, y: 0.28, z: -0.30 },
  { x: -0.12, y: 0.16, z: 0.55 },
  { x: 0.52, y: 0.34, z: -0.15 },
  { x: 0.02, y: 0.58, z: 0.10 },
];

/** Visual adjacency — a ring plus a few chords, so it reads as a web. */
const EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 5], [5, 6], [6, 4], [4, 3], [3, 0],
  [1, 4], [4, 2], [0, 4], [6, 1],
];

/** Travelling highlights along the filaments. */
interface Pulse {
  edge: number;
  t: number;
  speed: number;
}

const FOV = 900;

function cssVar(el: HTMLElement, name: string, fallback: string) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

export function Constellation({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduce = useReducedMotion();
  const t = useTranslations('unescoEntry');

  const nodesRef = useRef<Node3D[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const hoverRef = useRef<number>(-1);
  const rafRef = useRef<number>(0);
  const visibleRef = useRef(true);

  const zones = KATHMANDU_VALLEY.monumentZones ?? [];

  /** Build nodes once, and start loading each monument's photograph. */
  const initNodes = useCallback(() => {
    if (nodesRef.current.length) return;
    nodesRef.current = zones.slice(0, LAYOUT.length).map((zone, i) => {
      const node: Node3D = {
        key: zone.key,
        label: zone.canonicalName,
        href: museumHref(zone.key),
        ...LAYOUT[i],
        img: null,
        px: 0, py: 0, pr: 0, scale: 1,
      };
      const src = imageryFor(zone.key)?.image?.url;
      if (src) {
        const im = new Image();
        // Same-origin through the optimiser: no CORS dance, and a 256px
        // thumbnail instead of a 2000px original.
        im.src = `/_next/image?url=${encodeURIComponent(src)}&w=256&q=70`;
        im.onload = () => { node.img = im; };
      }
      return node;
    });
    pulsesRef.current = EDGES.map((_, i) => ({
      edge: i,
      t: Math.random(),
      speed: 0.12 + Math.random() * 0.16,
    }));
  }, [zones]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    initNodes();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // Pause entirely when scrolled away — an animation nobody can see is pure
    // battery drain.
    const io = new IntersectionObserver(
      ([e]) => { visibleRef.current = e.isIntersecting; },
      { threshold: 0.05 },
    );
    io.observe(wrap);

    const styleHost = wrap;
    let spin = 0;
    let camX = 0, camY = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const nodes = nodesRef.current;
      // Spread on each axis separately. A single min(w,h) radius left the web
      // huddled in the middle of a wide box, using about 40% of the width.
      const rx = w * 0.44;
      const ry = h * 0.43;
      const radius = Math.min(w, h) * 0.42; // depth scale reference only
      const cx = w / 2;
      const cy = h / 2;

      if (!reduce) {
        spin += dt * 0.12;
        // Ease the camera toward the pointer so it feels weighted, not twitchy.
        const tx = pointerRef.current.active ? pointerRef.current.x * 0.28 : 0;
        const ty = pointerRef.current.active ? pointerRef.current.y * 0.18 : 0;
        camX += (tx - camX) * Math.min(1, dt * 3);
        camY += (ty - camY) * Math.min(1, dt * 3);
      }

      const fg = cssVar(styleHost, '--foreground', '#121815');
      const primary = cssVar(styleHost, '--primary', '#26584a');
      const border = cssVar(styleHost, '--border', '#c6cfc7');

      ctx.clearRect(0, 0, w, h);

      // ── project ──
      const sy = Math.sin(spin + camX), cyr = Math.cos(spin + camX);
      for (const n of nodes) {
        // Yaw around Y, then a small pitch from the pointer.
        const px3 = n.x * cyr - n.z * sy;
        const rz = n.x * sy + n.z * cyr;
        const py3 = n.y + camY * rz * 0.5;
        const depth = rz * radius;
        const scale = FOV / (FOV + depth * 1.6);
        n.px = cx + px3 * rx * scale;
        n.py = cy + py3 * ry * scale;
        n.scale = scale;
        n.pr = Math.max(12, 27 * scale);
      }

      // ── edges behind nodes ──
      ctx.lineCap = 'round';
      EDGES.forEach(([a, b], i) => {
        const na = nodes[a], nb = nodes[b];
        if (!na || !nb) return;
        const depth = (na.scale + nb.scale) / 2;
        // A gentle bow so the web reads as strung, not wired.
        const mx = (na.px + nb.px) / 2 + (na.py - nb.py) * 0.09;
        const my = (na.py + nb.py) / 2 + (nb.px - na.px) * 0.09;

        ctx.beginPath();
        ctx.moveTo(na.px, na.py);
        ctx.quadraticCurveTo(mx, my, nb.px, nb.py);
        const lit = hoverRef.current === a || hoverRef.current === b;
        ctx.strokeStyle = lit ? primary : border;
        ctx.globalAlpha = (lit ? 0.9 : 0.45) * depth;
        ctx.lineWidth = (lit ? 1.8 : 1.1) * depth;
        ctx.stroke();

        // Travelling highlight — the "current" running through the web.
        const p = pulsesRef.current[i];
        if (p) {
          if (!reduce) {
            p.t += dt * p.speed;
            if (p.t > 1) p.t -= 1;
          }
          const u = p.t;
          const inv = 1 - u;
          const bx = inv * inv * na.px + 2 * inv * u * mx + u * u * nb.px;
          const by = inv * inv * na.py + 2 * inv * u * my + u * u * nb.py;
          const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 11 * depth);
          glow.addColorStop(0, primary);
          glow.addColorStop(1, 'transparent');
          ctx.globalAlpha = (lit ? 0.95 : 0.6) * depth;
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(bx, by, 11 * depth, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;

      // ── nodes, far to near ──
      const order = nodes.map((_, i) => i).sort((a, b) => nodes[a].scale - nodes[b].scale);
      for (const i of order) {
        const n = nodes[i];
        const hovered = hoverRef.current === i;
        const r = n.pr * (hovered ? 1.14 : 1);
        ctx.globalAlpha = 0.45 + 0.55 * n.scale;

        ctx.save();
        ctx.beginPath();
        ctx.arc(n.px, n.py, r, 0, Math.PI * 2);
        ctx.clip();
        if (n.img) {
          ctx.drawImage(n.img, n.px - r, n.py - r, r * 2, r * 2);
        } else {
          ctx.fillStyle = border;
          ctx.fillRect(n.px - r, n.py - r, r * 2, r * 2);
        }
        ctx.restore();

        ctx.beginPath();
        ctx.arc(n.px, n.py, r, 0, Math.PI * 2);
        ctx.strokeStyle = hovered ? primary : fg;
        ctx.globalAlpha = hovered ? 0.9 : 0.28 * n.scale;
        ctx.lineWidth = hovered ? 2 : 1;
        ctx.stroke();

      }
      ctx.globalAlpha = 1;

      // Label pass, on top of everything.
      const hv = hoverRef.current;
      if (hv >= 0 && nodes[hv]) {
        const n = nodes[hv];
        const label = n.label;
        ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        const tw = ctx.measureText(label).width;
        const ly = n.py + n.pr * 1.14 + 20;
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = cssVar(styleHost, '--card', '#f1f4f0');
        ctx.beginPath();
        ctx.roundRect(n.px - tw / 2 - 8, ly - 14, tw + 16, 22, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = fg;
        ctx.fillText(label, n.px, ly + 2);
      }
      ctx.globalAlpha = 1;

      if (!reduce && visibleRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    // Restart the loop when the section scrolls back in.
    const kick = () => {
      if (!reduce && visibleRef.current) {
        cancelAnimationFrame(rafRef.current);
        last = performance.now();
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    const onScroll = () => kick();
    window.addEventListener('scroll', onScroll, { passive: true });

    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      pointerRef.current = {
        x: ((e.clientX - r.left) / r.width - 0.5) * 2,
        y: ((e.clientY - r.top) / r.height - 0.5) * 2,
        active: true,
      };
      let hit = -1;
      const nodes = nodesRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (Math.hypot(e.clientX - r.left - n.px, e.clientY - r.top - n.py) < n.pr) {
          hit = i;
          break;
        }
      }
      if (hit !== hoverRef.current) {
        hoverRef.current = hit;
        wrap.style.cursor = hit >= 0 ? 'pointer' : 'default';
      }
      kick();
    };
    const onLeave = () => {
      pointerRef.current.active = false;
      hoverRef.current = -1;
      wrap.style.cursor = 'default';
    };
    const onClick = () => {
      const i = hoverRef.current;
      if (i >= 0) router.push(nodesRef.current[i].href);
    };
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', onLeave);
    wrap.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerleave', onLeave);
      wrap.removeEventListener('click', onClick);
    };
  }, [initNodes, reduce, router]);

  return (
    <div
      ref={wrapRef}
      className={cn('relative aspect-[4/3] w-full select-none sm:aspect-[16/10]', className)}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      {/* The canvas is decoration. The zones themselves are listed as real
          links directly below this section, which is what assistive technology
          and keyboard users follow. */}
      <p className="sr-only">{t('constellationAlt')}</p>
    </div>
  );
}
