'use client';

/**
 * Depth primitives for the entry page.
 *
 * The page should not feel flat to scroll, but every effect here follows one
 * rule learned the hard way earlier in this work: motion may change how
 * something looks, never whether it is readable. Nothing below sets opacity,
 * nothing gates content on an observer, and every effect collapses to a plain
 * static element under `prefers-reduced-motion`.
 */

import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';

import { cn } from '@/lib/utils';

/**
 * Parallax layer: moves slower than the page, so the photograph behind the
 * title feels set back from it.
 *
 * `distance` is the total travel in pixels across the element's whole scroll
 * pass. Kept small — a big offset reads as a glitch, not as depth.
 */
export function Parallax({
  children,
  distance = 60,
  className,
}: {
  children: React.ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // Parallax is a post-mount enhancement. The server cannot know the reader's
  // motion preference — useReducedMotion() is null there — so anything derived
  // from it that reaches the DOM (a class, an initial transform) makes the
  // server and client markup disagree. Rendering the neutral state on both the
  // server and the first client pass, then enabling after mount, keeps the two
  // identical and costs nothing visible.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  // Zero travel is the neutral state: no parallax before mount, and none at all
  // for a reader who prefers reduced motion.
  const travel = mounted && !reduce ? distance : 0;
  const y = useTransform(scrollYProgress, [0, 1], [-travel / 2, travel / 2]);

  // `relative` is a base so the element is never statically positioned —
  // useScroll needs a positioned target to measure against. A caller's
  // `absolute` still wins through tailwind-merge.
  return (
    <div ref={ref} className={cn('relative will-change-transform', className)}>
      {/* h-full matters: when Parallax is used as an absolutely-positioned
          layer, an auto-height wrapper collapses and any <Image fill> inside
          it renders at zero height. */}
      <motion.div style={{ y }} className="h-full w-full">
        {children}
      </motion.div>
    </div>
  );
}

/**
 * A card that tilts very slightly toward the pointer.
 *
 * Pointer-only by design: it is a flourish, so it never fires for keyboard or
 * touch users and never moves anything they need to hit. The rotation is
 * deliberately under two degrees — enough to catch the light, not enough to
 * make a photograph look like it is falling over.
 */
export function TiltCard({
  children,
  className,
  max = 1.8,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const lift = useMotionValue(0);
  const spring = { stiffness: 180, damping: 18, mass: 0.4 };
  const rotateX = useSpring(rx, spring);
  const rotateY = useSpring(ry, spring);
  const translateZ = useSpring(lift, spring);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Same reasoning as Parallax: never branch the tree on reduced motion.
    if (reduce || e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * max * 2);
    rx.set(-py * max * 2);
    lift.set(6);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
    lift.set(0);
  };


  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={reset} style={{ perspective: 900 }}>
      <motion.div
        style={{ rotateX, rotateY, translateZ, transformStyle: 'preserve-3d' }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * A soft atmospheric wash behind a section.
 *
 * Token-driven and very low alpha — this is depth, not the neon "hero glow"
 * that makes a page look generated. It sits behind content and is hidden from
 * assistive technology.
 *
 * A radial gradient rather than a blurred element inside `overflow-hidden`.
 * Clipping a blur leaves a dead-straight edge exactly where the blur is cut,
 * which put a faint rectangular band across the section.
 *
 * The geometry matters as much as the technique: the ellipse is centred inside
 * the element and sized in percentages so it reaches full transparency before
 * any of the four edges. Anchored at the top edge instead (`at 50% 0%`) it is at
 * full strength exactly where the section begins, which is the same visible
 * seam by a different route.
 */
export function AmbientWash({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(58rem_30rem_at_50%_0%,color-mix(in_oklab,var(--primary)_8%,transparent)_0%,transparent_72%)]',
        className,
      )}
    />
  );
}

/**
 * A very slow drift of motes behind the whole page.
 *
 * The brief was to make the page feel alive rather than static. This is
 * deliberately near the threshold of noticing: a few dozen specks in the accent
 * hue at low alpha, moving slowly enough that you register the page as breathing
 * without ever being asked to look at it. Anything more assertive would compete
 * with the photography, which is the actual subject.
 *
 * Fixed behind all content, hidden from assistive technology, and it does not
 * run at all under reduced motion or while the tab is hidden.
 */
export function LiveBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduce) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, raf = 0, running = true;
    const motes: Array<{ x: number; y: number; r: number; vx: number; vy: number; a: number }> = [];

    const seed = () => {
      motes.length = 0;
      // Density scaled to area, capped — a fixed count is a swarm on a phone
      // and invisible on a 27-inch display.
      const n = Math.min(46, Math.round((w * h) / 42000));
      for (let i = 0; i < n; i++) {
        motes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.7 + Math.random() * 1.9,
          vx: (Math.random() - 0.5) * 5,
          vy: -3 - Math.random() * 7,
          a: 0.05 + Math.random() * 0.13,
        });
      }
    };

    // Size the backing store from the canvas's own rendered box, never from
    // window.innerWidth. innerWidth includes the scrollbar, and the scrollbar
    // only appears once content is tall enough — so a canvas sized at load is
    // ~15px too wide the moment the page grows, and a fixed element that wide
    // makes the whole document scroll sideways. Letting CSS (`inset-0`) do the
    // sizing and observing the result is self-correcting.
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const colour = () =>
      getComputedStyle(canvas).getPropertyValue('--primary').trim() || '#26584a';

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.06, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colour();
      for (const m of motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
        if (m.x < -10) m.x = w + 10;
        if (m.x > w + 10) m.x = -10;
        ctx.globalAlpha = m.a;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (running) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onVis = () => {
      running = document.visibilityState === 'visible';
      if (running) { last = performance.now(); raf = requestAnimationFrame(tick); }
      else cancelAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduce]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
