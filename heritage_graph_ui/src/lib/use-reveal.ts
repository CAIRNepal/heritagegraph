'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import { revealViewport } from '@/lib/design';

/**
 * Motion props for a scroll-revealed section, safe to server-render.
 *
 * `useReducedMotion()` returns null on the server and a real boolean on the
 * client, so any prop derived from it changes what Framer writes into the
 * element's inline style between the two passes. React reports that as
 * "some attributes of the server rendered HTML didn't match the client" and —
 * importantly — says it will not patch it up, which left reduced-motion
 * readers looking at content stuck 24px below where it belonged.
 *
 * The fix is to make the first render identical everywhere: server and the
 * first client pass both emit the `hidden` variant and nothing else. Only after
 * mount, when the preference is actually knowable, does the component pick
 * between animating on scroll and simply asserting the shown state.
 *
 * Pair with `revealOnScroll`, which moves transform only — so even the single
 * frame before mount is fully legible.
 */
export function useReveal() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Matches the server exactly.
    return { initial: 'hidden' as const };
  }
  if (reduce) {
    // No scroll trigger at all: assert the shown state so visibility never
    // depends on an observer firing.
    return { initial: 'hidden' as const, animate: 'show' };
  }
  return {
    initial: 'hidden' as const,
    whileInView: 'show',
    viewport: revealViewport,
  };
}
