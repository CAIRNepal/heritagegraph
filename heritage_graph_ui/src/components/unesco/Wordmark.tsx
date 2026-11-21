'use client';

/**
 * The HeritageGraph wordmark, cut in relief.
 *
 * The reference is inscription rather than product logo: letters that look
 * carved into the surface behind them, which is the right register for a
 * heritage record and avoids the plastic look a deep black extrusion gives.
 * Three things do the work — a short extrusion in a warm dark tone rather than
 * pure black, a lit top edge on the face so each letter catches light from
 * above, and a wide soft shadow underneath for lift. A weight break between
 * "Heritage" and "Graph" makes the name read as a compound.
 *
 * The extrusion is stacked copies rather than a CSS `text-shadow` chain because
 * each layer needs its own falloff, and because the copies are `aria-hidden` —
 * a screen reader hears the name once, from the real heading.
 *
 * Colours here are deliberately not tokens: this sits on a photograph, which is
 * the same in both themes, so it stays light-on-dark either way.
 */

import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

import { cn } from '@/lib/utils';

/**
 * Extrusion depth, in pixels per layer, back to front. Shallower than a display
 * 3D effect on purpose — past about 8px the letters stop reading as carved and
 * start reading as extruded plastic.
 */
const LAYERS = [7, 5.6, 4.4, 3.3, 2.3, 1.4, 0.7];

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
    'font-serif leading-[0.9] tracking-[-0.028em] text-[clamp(1.85rem,8.5vw,6.5rem)]';

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ perspective: 1000 }}
      className={cn('relative w-fit', className)}
    >
      <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }} className="relative">
        {/* A single wide, soft shadow well behind the letters. This is what
            lifts the whole word off the photograph; the extrusion below only
            gives it thickness. */}
        <span
          aria-hidden="true"
          className={cn(type, 'absolute inset-0 block select-none whitespace-nowrap')}
          style={{
            transform: 'translate3d(0, 14px, -80px)',
            color: 'rgba(6,10,8,0.5)',
            filter: 'blur(18px)',
          }}
        >
          <span className="font-bold">{first}</span>
          <span className="font-light">{second}</span>
        </span>

        {/* Extruded body. Each copy sits a little further back and darker, so
            the face of the letters reads as standing off the photograph. */}
        {LAYERS.map((d, i) => (
          <span
            key={d}
            aria-hidden="true"
            className={cn(type, 'absolute inset-0 block whitespace-nowrap select-none')}
            style={{
              // Down and very slightly right: light from above and a touch to
              // the left, which is how the rest of the page is lit.
              transform: `translate3d(${d * 0.32}px, ${d}px, ${-d * 6}px)`,
              // Warm near-black, not pure black. Pure black against a
              // photograph reads as a sticker.
              color: `rgba(14,20,17,${0.46 - i * 0.05})`,
              filter: 'blur(0.3px)',
            }}
          >
            <span className="font-bold">{first}</span>
            <span className="font-light">{second}</span>
          </span>
        ))}

        <h1
          id={id}
          className={cn(type, 'relative block whitespace-nowrap text-white')}
          style={{
            // A lit top edge and the faintest dark lip below it: the two
            // together are what make the face read as a cut surface.
            textShadow:
              '0 -1px 0 rgba(255,255,255,0.55), 0 1px 0 rgba(14,20,17,0.35), 0 10px 26px rgba(0,0,0,0.35)',
          }}
        >
          <span className="font-bold">{first}</span>
          <span className="font-light text-white/90">{second}</span>
        </h1>
      </motion.div>
    </div>
  );
}
