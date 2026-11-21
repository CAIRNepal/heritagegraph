'use client';

/**
 * Draws living connections between the cards it wraps.
 *
 * The zone index was a plain grid, which quietly contradicts the product: a row
 * of separate boxes is exactly the "list, not a graph" model the platform
 * exists to replace. This measures where its children actually landed and
 * strings them together, so the index reads as one connected thing.
 *
 * THREE THINGS MAKE THE CONNECTIONS READ AS CONNECTIONS
 *
 *  1. They are clipped to the card edges, not drawn centre to centre. A
 *     centre-to-centre line spends most of its length behind a photograph, so
 *     only faint slivers ever showed in the gutters. Clipping puts the whole
 *     stroke, and a terminal at each end, in the space where it can be seen.
 *  2. Each one is drawn in several passes — a glow carrying a cast shadow, a
 *     crisp core, a dashed overlay sliding along it, and a travelling head of
 *     light. One hairline stroke reads as a border artefact; a lifted, lit
 *     cable reads as a link.
 *  3. Pointing at a card brightens the connections that touch it and dims the
 *     rest. That is the whole idea of the platform delivered without a word of
 *     explanation: this thing is attached to those things.
 *
 * It measures rather than assumes: the grid reflows from one column to three,
 * so hard-coded connections would be wrong at most widths. Neighbours are
 * chosen by measured proximity, so the web is a real graph at every count.
 *
 * Purely decorative — the canvas is hidden from assistive technology and the
 * cards remain ordinary links, in order, whether or not any of this paints.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

interface Box {
  /** Centre, relative to the wrapper. */
  cx: number;
  cy: number;
  /** Half-extents, used to clip a connection to the card's edge. */
  hw: number;
  hh: number;
}

interface Edge {
  a: number;
  b: number;
  /** Terminals, on the two card edges. */
  pa: { x: number; y: number };
  pb: { x: number; y: number };
  /** Quadratic control point. */
  mx: number;
  my: number;
  /** 1 = short and near, 0 = long and far. Drives thickness and brightness. */
  near: number;
}

function cssVar(el: HTMLElement, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/**
 * Where a ray leaving a box's centre crosses its edge, pushed `pad` further out
 * so the terminal sits in the gutter rather than on the card border.
 */
function edgePoint(b: Box, dx: number, dy: number, pad: number) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tx = Math.abs(ux) > 1e-6 ? b.hw / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-6 ? b.hh / Math.abs(uy) : Infinity;
  const t = Math.min(tx, ty) + pad;
  return { x: b.cx + ux * t, y: b.cy + uy * t };
}

/** Point at parameter u along a quadratic bezier. */
function along(e: Edge, u: number) {
  const inv = 1 - u;
  return {
    x: inv * inv * e.pa.x + 2 * inv * u * e.mx + u * u * e.pb.x,
    y: inv * inv * e.pa.y + 2 * inv * u * e.my + u * u * e.pb.y,
  };
}

export function CardWeb({
  children,
  className,
  /** CSS selector for the elements to connect, within this wrapper. */
  itemSelector = '[data-web-node]',
}: {
  children: React.ReactNode;
  className?: string;
  itemSelector?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxesRef = useRef<Box[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const rafRef = useRef(0);
  const visibleRef = useRef(true);
  /** Index of the card being pointed at or focused, or -1. */
  const hotRef = useRef(-1);
  /** Eases the highlight in and out so it never snaps. */
  const hotMixRef = useRef(0);
  const reduce = useReducedMotion();

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const base = wrap.getBoundingClientRect();
    const nodes = Array.from(wrap.querySelectorAll<HTMLElement>(itemSelector));
    const boxes = nodes.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        cx: r.left - base.left + r.width / 2,
        cy: r.top - base.top + r.height / 2,
        hw: r.width / 2,
        hh: r.height / 2,
      };
    });
    boxesRef.current = boxes;

    // Neighbours by measured distance, not by index: the grid runs one, two or
    // three columns wide, and the two closest cards are the ones a reader sees
    // as adjacent at any of them. The sequential chain is added on top so
    // reading order is always drawn.
    const pairs: Array<[number, number]> = [];
    const seen = new Set<string>();
    const add = (a: number, b: number) => {
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push([a, b]);
    };
    boxes.forEach((p, i) => {
      boxes
        .map((q, j) => ({ j, d: Math.hypot(q.cx - p.cx, q.cy - p.cy) }))
        .filter((o) => o.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2)
        .forEach((o) => add(i, o.j));
    });
    for (let i = 0; i < boxes.length - 1; i++) add(i, i + 1);

    const spans = pairs.map(([a, b]) => Math.hypot(boxes[b].cx - boxes[a].cx, boxes[b].cy - boxes[a].cy));
    const maxSpan = Math.max(1, ...spans);

    edgesRef.current = pairs.flatMap(([a, b], k) => {
      const ba = boxes[a];
      const bb = boxes[b];
      const dx = bb.cx - ba.cx;
      const dy = bb.cy - ba.cy;
      const pa = edgePoint(ba, dx, dy, 5);
      const pb = edgePoint(bb, -dx, -dy, 5);
      // Terminals that have crossed over mean the cards are touching, so there
      // is no gutter for a connection to live in.
      if ((pb.x - pa.x) * dx + (pb.y - pa.y) * dy <= 0) return [];
      const near = 1 - Math.min(1, spans[k] / maxSpan) * 0.5;

      // Bow by an absolute number of pixels, not by a fraction of the span. A
      // proportional bow gives the short hop between two side-by-side cards an
      // arc of two or three pixels, which is a straight stub — and a straight
      // stub reads as a divider, not a connection. The perpendicular vector
      // used below has the segment's own length, so dividing by that length
      // turns a pixel target back into a bow factor.
      const run = Math.max(1, Math.hypot(pb.x - pa.x, pb.y - pa.y));
      const bow = Math.min(26, Math.max(9, run * 0.16)) / run;
      return [
        {
          a,
          b,
          pa,
          pb,
          mx: (pa.x + pb.x) / 2 + (pa.y - pb.y) * bow,
          my: (pa.y + pb.y) / 2 + (pb.x - pa.x) * bow,
          near,
        },
      ];
    });
  }, [itemSelector]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      measure();
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    for (const el of wrap.querySelectorAll(itemSelector)) ro.observe(el);

    const io = new IntersectionObserver(([e]) => { visibleRef.current = e.isIntersecting; }, {
      threshold: 0.02,
    });
    io.observe(wrap);

    let t = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) t += dt;

      const edges = edgesRef.current;
      ctx.clearRect(0, 0, w, h);
      if (edges.length === 0) {
        if (!reduce && visibleRef.current) rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Ease the highlight rather than switching it, so moving between cards
      // reads as attention shifting instead of a light being flicked.
      const target = hotRef.current >= 0 ? 1 : 0;
      hotMixRef.current += (target - hotMixRef.current) * Math.min(1, dt * 7);
      const mix = hotMixRef.current;
      const hot = hotRef.current;

      const primary = cssVar(wrap, '--primary', '#26584a');
      const glyph = cssVar(wrap, '--node-glyph', primary);

      ctx.lineCap = 'round';

      for (const e of edges) {
        const touches = hot >= 0 && (e.a === hot || e.b === hot);
        // Highlighted connections come up; the rest step back. With no card
        // under the pointer everything sits at its resting brightness.
        const lift = touches ? mix : -mix * 0.55;
        const core = 0.32 + 0.32 * e.near + lift * 0.5;
        const width = 1.3 + 1.6 * e.near + (touches ? mix * 1.4 : 0);

        ctx.beginPath();
        ctx.moveTo(e.pa.x, e.pa.y);
        ctx.quadraticCurveTo(e.mx, e.my, e.pb.x, e.pb.y);

        // 1 — soft glow, carrying a cast shadow offset below it. The offset is
        //     what makes the connection read as lying above the page rather
        //     than ruled onto it. `shadowBlur` rather than `ctx.filter`, which
        //     Safari only gained recently.
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 7;
        ctx.shadowOffsetY = 2.5 + e.near;
        ctx.strokeStyle = primary;
        ctx.globalAlpha = Math.max(0, core * 0.34);
        ctx.lineWidth = width + 7;
        ctx.stroke();
        ctx.restore();

        // 2 — crisp core.
        ctx.strokeStyle = primary;
        ctx.globalAlpha = Math.max(0.04, core);
        ctx.lineWidth = width;
        ctx.stroke();

        // 3 — a dashed overlay sliding along the cable. Movement along the line
        //     is what turns a drawn link into a live one.
        if (!reduce) {
          ctx.save();
          ctx.setLineDash([3, 16]);
          ctx.lineDashOffset = -t * (26 + 30 * e.near);
          ctx.strokeStyle = glyph;
          ctx.globalAlpha = Math.max(0, 0.35 + 0.3 * e.near + lift * 0.5);
          ctx.lineWidth = Math.max(1, width * 0.75);
          ctx.stroke();
          ctx.restore();
        }

        // A travelling head of light, so there is always one clear direction
        // of flow to follow.
        const speed = 0.16 + 0.1 * e.near;
        const u = ((t * speed + (e.a * 0.19 + e.b * 0.11)) % 1 + 1) % 1;
        const p = along(e, u);
        const rad = (8 + 6 * e.near) * (1 + (touches ? mix * 0.45 : 0));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
        g.addColorStop(0, primary);
        g.addColorStop(0.45, primary);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = Math.max(0, 0.45 + 0.3 * e.near + lift * 0.4);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Terminals last, so nothing is drawn over them. A dot with a breathing
      // ring: the ring is what stops seven identical dots reading as bullet
      // points.
      const drawn = new Set<string>();
      for (const e of edges) {
        const touches = hot >= 0 && (e.a === hot || e.b === hot);
        const lift = touches ? mix : -mix * 0.55;
        for (const [side, pt] of [['a', e.pa], ['b', e.pb]] as const) {
          const key = `${side === 'a' ? e.a : e.b}:${Math.round(pt.x)}:${Math.round(pt.y)}`;
          if (drawn.has(key)) continue;
          drawn.add(key);

          const breathe = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.7 + pt.x * 0.05);
          ctx.globalAlpha = Math.max(0.08, 0.75 + lift * 0.3);
          ctx.fillStyle = primary;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3 + (touches ? mix * 1.2 : 0), 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = Math.max(0.03, (0.3 - breathe * 0.16) + lift * 0.25);
          ctx.strokeStyle = primary;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6 + breathe * 5 + (touches ? mix * 3 : 0), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Reduced motion still gets one composed frame; it just does not loop.
      if (!reduce && visibleRef.current) rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    const restart = () => {
      cancelAnimationFrame(rafRef.current);
      last = performance.now();
      rafRef.current = requestAnimationFrame(draw);
    };
    const kick = () => {
      if (visibleRef.current) restart();
    };

    /** Which measured card, if any, a point falls inside. */
    const hitTest = (x: number, y: number) =>
      boxesRef.current.findIndex(
        (b) => Math.abs(x - b.cx) <= b.hw && Math.abs(y - b.cy) <= b.hh,
      );

    const onMove = (ev: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      const next = hitTest(ev.clientX - r.left, ev.clientY - r.top);
      if (next === hotRef.current) return;
      hotRef.current = next;
      kick();
    };
    const onLeave = () => {
      if (hotRef.current === -1) return;
      hotRef.current = -1;
      kick();
    };
    // Keyboard users tab through the cards and get the same highlight.
    const onFocus = (ev: FocusEvent) => {
      const el = (ev.target as HTMLElement | null)?.closest<HTMLElement>(itemSelector);
      const items = Array.from(wrap.querySelectorAll<HTMLElement>(itemSelector));
      const next = el ? items.indexOf(el) : -1;
      if (next === hotRef.current) return;
      hotRef.current = next;
      kick();
    };

    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', onLeave);
    wrap.addEventListener('focusin', onFocus);
    window.addEventListener('scroll', kick, { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      io.disconnect();
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerleave', onLeave);
      wrap.removeEventListener('focusin', onFocus);
      window.removeEventListener('scroll', kick);
    };
  }, [measure, itemSelector, reduce]);

  return (
    // `isolate` matters: without a stacking context of its own, a negative
    // z-index would push the canvas behind the page background and it would
    // never be seen. Painting order does the rest — canvas first, cards after.
    <div ref={wrapRef} className={cn('relative isolate', className)}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
