'use client';

/**
 * Draws living filaments between the cards it wraps.
 *
 * The zone index was a plain grid, which quietly contradicts the product: a row
 * of separate boxes is exactly the "list, not a graph" model the platform
 * exists to replace. This measures where its children actually landed and
 * strings them together behind the content, with the same travelling light as
 * the hero constellation, so the index reads as part of the same web.
 *
 * It measures rather than assumes: the grid reflows from one column to three,
 * so hard-coded connections would be wrong at most widths. A ResizeObserver
 * re-reads positions whenever the layout changes, and neighbours are chosen by
 * measured proximity so the web is a real graph at every column count.
 *
 * Filaments are clipped to the card edges rather than drawn between centres.
 * Centre-to-centre lines spend most of their length hidden behind the cards, so
 * only faint slivers showed in the gutters; clipping puts the whole stroke, and
 * a node at each end, in the space where it can actually be seen.
 *
 * Purely decorative — the canvas is hidden from assistive technology and sits
 * behind the cards, which remain ordinary links.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

interface Box {
  /** Centre, relative to the wrapper. */
  cx: number;
  cy: number;
  /** Half-extents, used to clip a filament to the card's edge. */
  hw: number;
  hh: number;
}

/**
 * Where a ray leaving a box's centre crosses its edge, pushed `pad` further out
 * so the node sits in the gutter rather than on the card border.
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

function cssVar(el: HTMLElement, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
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
  const ptsRef = useRef<Box[]>([]);
  const rafRef = useRef(0);
  const visibleRef = useRef(true);
  const reduce = useReducedMotion();

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const base = wrap.getBoundingClientRect();
    const nodes = Array.from(wrap.querySelectorAll<HTMLElement>(itemSelector));
    ptsRef.current = nodes.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        cx: r.left - base.left + r.width / 2,
        cy: r.top - base.top + r.height / 2,
        hw: r.width / 2,
        hh: r.height / 2,
      };
    });
  }, [itemSelector]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
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

    const io = new IntersectionObserver(
      ([e]) => { visibleRef.current = e.isIntersecting; },
      { threshold: 0.02 },
    );
    io.observe(wrap);

    let t = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) t += dt * 0.16;

      const pts = ptsRef.current;
      ctx.clearRect(0, 0, w, h);
      if (pts.length < 2) {
        if (!reduce && visibleRef.current) rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const primary = cssVar(wrap, '--primary', '#26584a');

      // Neighbours by measured distance, not by index: the grid runs one, two
      // or three columns wide, and the two closest cards are the ones a reader
      // sees as adjacent at any of them. The sequential chain is added on top so
      // reading order is always drawn.
      const pairs: Array<[number, number]> = [];
      const seen = new Set<string>();
      const add = (a: number, b: number) => {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(key)) return;
        seen.add(key);
        pairs.push([a, b]);
      };
      pts.forEach((p, i) => {
        pts
          .map((q, j) => ({ j, d: Math.hypot(q.cx - p.cx, q.cy - p.cy) }))
          .filter((o) => o.j !== i)
          .sort((a, b) => a.d - b.d)
          .slice(0, 2)
          .forEach((o) => add(i, o.j));
      });
      for (let i = 0; i < pts.length - 1; i++) add(i, i + 1);

      // Longer filaments read as further away: thinner, fainter, and bowed
      // less. That plus the drop shadow is what gives the web its depth.
      const spans = pairs.map(([a, b]) => Math.hypot(pts[b].cx - pts[a].cx, pts[b].cy - pts[a].cy));
      const maxSpan = Math.max(1, ...spans);

      ctx.lineCap = 'round';
      pairs.forEach(([a, b], k) => {
        const ba = pts[a];
        const bb = pts[b];
        const dx = bb.cx - ba.cx;
        const dy = bb.cy - ba.cy;
        const pa = edgePoint(ba, dx, dy, 5);
        const pb = edgePoint(bb, -dx, -dy, 5);

        // A filament whose endpoints have crossed over has no gutter to live in
        // (the cards are touching), so there is nothing to draw.
        if ((pb.x - pa.x) * dx + (pb.y - pa.y) * dy <= 0) return;

        const near = 1 - Math.min(1, spans[k] / maxSpan) * 0.55;
        const bow = 0.1 * near;
        const mx = (pa.x + pb.x) / 2 + (pa.y - pb.y) * bow;
        const my = (pa.y + pb.y) / 2 + (pb.x - pa.x) * bow;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.quadraticCurveTo(mx, my, pb.x, pb.y);
        ctx.strokeStyle = primary;
        ctx.globalAlpha = 0.2 + 0.34 * near;
        ctx.lineWidth = 1.1 + 1.5 * near;
        ctx.stroke();
        ctx.restore();

        // One travelling highlight per filament, offset so they do not pulse
        // in unison.
        const u = (t * (0.5 + (k % 3) * 0.18) + k * 0.17) % 1;
        const inv = 1 - u;
        const px = inv * inv * pa.x + 2 * inv * u * mx + u * u * pb.x;
        const py = inv * inv * pa.y + 2 * inv * u * my + u * u * pb.y;
        const rad = 9 + 5 * near;
        const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, primary);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.55 + 0.35 * near;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();

        // A node where each filament meets its card, so the connection has
        // visible terminals instead of vanishing under the photograph.
        for (const pt of [pa, pb]) {
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = primary;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = primary;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;

      if (!reduce && visibleRef.current) rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    const kick = () => {
      if (!reduce && visibleRef.current) {
        cancelAnimationFrame(rafRef.current);
        last = performance.now();
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    window.addEventListener('scroll', kick, { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      io.disconnect();
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
