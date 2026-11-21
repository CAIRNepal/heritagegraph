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
  { x: -0.74, y: -0.34, z: 0.72 },
  { x: 0.06, y: -0.58, z: -0.62 },
  { x: 0.80, y: -0.26, z: 0.44 },
  { x: -0.86, y: 0.30, z: -0.70 },
  { x: -0.14, y: 0.14, z: 0.95 },
  { x: 0.62, y: 0.38, z: -0.34 },
  { x: 0.02, y: 0.62, z: 0.18 },
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

const FOV = 560;

/**
 * Depth strength, in the same units as FOV.
 *
 * The projection used to take its depth from `min(w, h) * 0.42`, which meant the
 * divisor `FOV + depth * 2.6` came within ~24 of zero at the extremes of the
 * rotation: a node passing nearest the camera reached a scale above 20 and grew
 * to several hundred pixels across. Because depth is a unit-ish coordinate, the
 * strength belongs here as a constant rather than being derived from the canvas
 * — the on-screen spread is already scaled by rx/ry — and at 239 the scale stays
 * inside roughly 0.7–1.9 at every viewport.
 */
const DEPTH = 239;

/** Hard ceiling on a node's drawn radius, whatever the perspective says. */
const NODE_MAX_R = 48;

/** Keep a projected coordinate within the canvas. */
function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

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
  /**
   * Paint one frame, restarting the loop if it had stopped.
   *
   * Held in a ref because the two things that need it — the intersection
   * observer and each photograph's load handler — are both defined before the
   * draw function exists.
   */
  const requestFrameRef = useRef<(() => void) | null>(null);

  /** Build nodes once, and start loading each monument's photograph. */
  const initNodes = useCallback(() => {
    if (nodesRef.current.length) return;
    const zones = KATHMANDU_VALLEY.monumentZones ?? [];
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
        // Handler BEFORE src, then a synchronous `complete` check.
        //
        // Assigning src first loses the load event for any image the browser
        // can satisfy from cache, because that completes before the next
        // statement attaches the handler — so the node kept its placeholder
        // for the life of the page. It showed up as a few grey discs among the
        // photographs, and got worse on every repeat visit as more of the seven
        // came from cache. The `complete` check covers the case where the event
        // has already been dispatched by the time we get here.
        im.onload = () => {
          node.img = im;
          // Ask for a frame. The loop may legitimately be stopped right now —
          // scrolled away, or a reader who prefers reduced motion and gets a
          // single frame — and that frame was painted before this photograph
          // existed. Without this the node keeps its placeholder disc for good.
          requestFrameRef.current?.();
        };
        // Same-origin through the optimiser: no CORS dance, and a 256px
        // thumbnail instead of a 2000px original.
        im.src = `/_next/image?url=${encodeURIComponent(src)}&w=256&q=70`;
        if (im.complete && im.naturalWidth > 0) node.img = im;
      }
      return node;
    });
    pulsesRef.current = EDGES.map((_, i) => ({
      edge: i,
      t: Math.random(),
      speed: 0.20 + Math.random() * 0.24,
    }));
  }, []);

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
      ([e]) => {
        const was = visibleRef.current;
        visibleRef.current = e.isIntersecting;
        // Restart here, not only on scroll. The loop stops itself when the
        // section leaves the viewport, and `kick` below can only restart it
        // once this flag is already true — so a reader who arrives with the
        // section on screen and then stops scrolling (an anchor jump, a single
        // flick, scrollIntoView) produced no further scroll event, and the
        // animation stayed frozen on whatever frame it last painted.
        if (e.isIntersecting && !was) requestFrameRef.current?.();
      },
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
      // Slightly inside the box so the edge feather at the end of this frame
      // dissolves the filaments running outward, not the faces themselves.
      const rx = w * 0.37;
      // Tighter than the horizontal spread: `px3` and `rz` are a quarter-turn
      // out of phase, so a node is at its widest when its scale is 1 and at its
      // biggest when it is dead centre — horizontal never needs the headroom.
      // Vertical does, because `y` does not rotate.
      const ry = h * 0.30;
      // Width of the soft band erased inward from each edge. Declared here
      // because the projection clamp below has to stay clear of it.
      const fx = Math.min(150, w * 0.12);
      const fy = Math.min(70, h * 0.1);
      const cx = w / 2;
      const cy = h / 2;

      if (!reduce) {
        spin += dt * 0.19;
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
        const scale = FOV / (FOV + rz * DEPTH);
        n.scale = scale;
        n.pr = clamp(26 * scale, 12, NODE_MAX_R);
        // Keep every face wholly inside the canvas, with room for the feather
        // and for the label that hangs below it. A projected node can otherwise
        // land within its own radius of the boundary and be sliced flat, which
        // looks like a rendering fault however good the rest of the frame is —
        // and a node erased entirely by the feather leaves its filaments
        // running to nothing. Clamping the projection is aspect-ratio
        // independent, so it holds at every width the band is asked to be.
        const mx0 = n.pr + fx * 0.55;
        const my0 = n.pr + fy * 0.55;
        n.px = clamp(cx + px3 * rx * scale, mx0, w - mx0);
        n.py = clamp(cy + py3 * ry * scale, my0, h - my0 - 18);
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
        ctx.strokeStyle = primary;
        ctx.globalAlpha = (lit ? 0.95 : 0.34) * depth;
        ctx.lineWidth = (lit ? 2.2 : 1.4) * depth;
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
          const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 13 * depth);
          glow.addColorStop(0, primary);
          glow.addColorStop(1, 'transparent');
          ctx.globalAlpha = (lit ? 1 : 0.8) * depth;
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(bx, by, 13 * depth, 0, Math.PI * 2);
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
        ctx.globalAlpha = Math.max(0.22, Math.min(1, n.scale * n.scale * 1.15));

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

      // Label pass, on top of everything. Nodes near the camera are always
      // named — the graph should read as seven identifiable places, not as
      // abstract dots that only resolve on hover.
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const n of nodes) {
        if (hoverRef.current >= 0 && nodes[hoverRef.current] === n) continue;
        if (n.scale < 0.92) continue;
        ctx.globalAlpha = Math.min(0.72, (n.scale - 0.92) * 7);
        ctx.fillStyle = fg;
        ctx.fillText(n.label, n.px, n.py + n.pr + 15);
      }
      ctx.globalAlpha = 1;

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

      // ── Feather the boundary ──────────────────────────────────────────
      // Everything above is drawn to the full rectangle, so a filament heading
      // for the edge was sliced off along a dead straight line and the whole
      // scene read as a panel pasted onto the page. Erasing a soft band inward
      // from each edge with `destination-out` makes those filaments dissolve
      // into the page instead of stopping at a border.
      //
      // Done on the canvas rather than as a CSS mask deliberately: a two-axis
      // CSS mask needs `mask-composite`, and where that is unsupported only one
      // of the two axes survives, which is a silent half-fix.
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-out';
      const band = (
        x0: number, y0: number, x1: number, y1: number,
        rectX: number, rectY: number, rectW: number, rectH: number,
      ) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(rectX, rectY, rectW, rectH);
      };
      band(0, 0, fx, 0, 0, 0, fx, h);
      band(w, 0, w - fx, 0, w - fx, 0, fx, h);
      band(0, 0, 0, fy, 0, 0, w, fy);
      band(0, h, 0, h - fy, 0, h - fy, w, fy);
      ctx.globalCompositeOperation = 'source-over';

      if (!reduce && visibleRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    // Cancel-then-schedule, so this is safe whether the loop is running or
    // stopped. Under reduced motion `draw` does not re-schedule itself, so this
    // paints exactly one more frame and settles again.
    requestFrameRef.current = () => {
      cancelAnimationFrame(rafRef.current);
      last = performance.now();
      rafRef.current = requestAnimationFrame(draw);
    };

    const kick = () => {
      if (!reduce && visibleRef.current) requestFrameRef.current?.();
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
      requestFrameRef.current = null;
      window.removeEventListener('scroll', onScroll);
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerleave', onLeave);
      wrap.removeEventListener('click', onClick);
    };
  }, [initNodes, reduce, router]);

  return (
    <div
      ref={wrapRef}
      className={cn('relative w-full select-none', className)}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      {/* The canvas is decoration. The zones themselves are listed as real
          links directly below this section, which is what assistive technology
          and keyboard users follow. */}
      <p className="sr-only">{t('constellationAlt')}</p>
    </div>
  );
}
