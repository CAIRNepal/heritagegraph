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
 * re-reads positions whenever the layout changes.
 *
 * Purely decorative — the canvas is hidden from assistive technology and sits
 * behind the cards, which remain ordinary links.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

interface Pt { x: number; y: number }

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
  const ptsRef = useRef<Pt[]>([]);
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
      return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
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

      const border = cssVar(wrap, '--border', '#c6cfc7');
      const primary = cssVar(wrap, '--primary', '#26584a');

      // Chain each card to the next, plus a longer skip, so the web has depth
      // instead of reading as a single dashed line.
      const pairs: Array<[number, number]> = [];
      for (let i = 0; i < pts.length - 1; i++) pairs.push([i, i + 1]);
      for (let i = 0; i + 2 < pts.length; i += 2) pairs.push([i, i + 2]);

      ctx.lineCap = 'round';
      pairs.forEach(([a, b], k) => {
        const pa = pts[a], pb = pts[b];
        const mx = (pa.x + pb.x) / 2 + (pa.y - pb.y) * 0.12;
        const my = (pa.y + pb.y) / 2 + (pb.x - pa.x) * 0.12;

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.quadraticCurveTo(mx, my, pb.x, pb.y);
        ctx.strokeStyle = border;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // One travelling highlight per filament, offset so they do not pulse
        // in unison.
        const u = (t * (0.5 + (k % 3) * 0.18) + k * 0.17) % 1;
        const inv = 1 - u;
        const bx = inv * inv * pa.x + 2 * inv * u * mx + u * u * pb.x;
        const by = inv * inv * pa.y + 2 * inv * u * my + u * u * pb.y;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, 10);
        g.addColorStop(0, primary);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, 10, 0, Math.PI * 2);
        ctx.fill();
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
