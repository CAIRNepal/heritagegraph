'use client';

/**
 * The HeritageGraph wordmark, given some physical presence.
 *
 * It was flat white type with a drop shadow. This gives it three things
 * instead: a real extrusion built from stacked offset copies, a slight
 * perspective tilt that follows the pointer, and a weight break between
 * "Heritage" and "Graph" so the name reads as a compound rather than one long
 * word.
 *
 * The extrusion is drawn from stacked copies rather than a CSS `text-shadow`
 * chain because each layer needs its own falloff, and because the copies are
 * `aria-hidden` — a screen reader hears the name once, from the real heading.
 *
 * Colours here are deliberately not tokens: this sits on a photograph, which is
 * the same in both themes, so it stays white-on-dark either way.
 */

import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

import { cn } from '@/lib/utils';

/** Extrusion depth, in pixels per layer, back to front. */
const LAYERS = [10, 8, 6, 4.5, 3, 2, 1];

export function Wordmark({
  first,
  second,
  className,
  id,
}: {
  /** "Heritage" — set in the display weight. */
  first: string;
  /** "Graph" — set lighter, so the compound reads. */
  second: string;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const spring = { stiffness: 140, damping: 20, mass: 0.6 };
  const rotateX = useSpring(rx, spring);
  const rotateY = useSpring(ry, spring);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Measured against the element's own box, so the tilt is about the type
    // rather than about where the cursor happens to be on the page.
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 9);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 6);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  // A clamp rather than breakpoint steps: the name is set on one line, so a
  // fixed size at any breakpoint eventually runs past the viewport. This scales
  // with the viewport and cannot overflow at either end.
  const type =
    'font-serif leading-[0.88] tracking-[-0.035em] text-[clamp(1.85rem,8.5vw,6.5rem)]';

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ perspective: 1000 }}
      className={cn('relative w-fit', className)}
    >
      <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }} className="relative">
        {/* Extruded body. Each copy sits a little further back and darker, so
            the face of the letters reads as standing off the photograph. */}
        {LAYERS.map((d, i) => (
          <span
            key={d}
            aria-hidden="true"
            className={cn(type, 'absolute inset-0 block whitespace-nowrap select-none')}
            style={{
              transform: `translate3d(${d * 0.55}px, ${d}px, ${-d * 6}px)`,
              color: `rgba(0,0,0,${0.34 - i * 0.04})`,
              filter: 'blur(0.4px)',
            }}
          >
            <span className="font-bold">{first}</span>
            <span className="font-light">{second}</span>
          </span>
        ))}

        <h1
          id={id}
          className={cn(type, 'relative block whitespace-nowrap text-white')}
          style={{ textShadow: '0 1px 0 rgba(255,255,255,0.35), 0 18px 40px rgba(0,0,0,0.45)' }}
        >
          <span className="font-bold">{first}</span>
          <span className="font-light text-white/90">{second}</span>
        </h1>
      </motion.div>
    </div>
  );
}
