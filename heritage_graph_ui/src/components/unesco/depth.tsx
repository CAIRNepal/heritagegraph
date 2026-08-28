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
 */
export function AmbientWash({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}
    >
      <div className="absolute left-1/2 top-0 h-[38rem] w-[70rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/[0.06] blur-3xl" />
    </div>
  );
}
