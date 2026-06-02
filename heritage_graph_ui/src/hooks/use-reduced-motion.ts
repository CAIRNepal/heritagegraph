'use client';

import { useEffect, useState } from 'react';

/**
 * Reactive `prefers-reduced-motion` hook.
 *
 * Unlike the one-shot read in `lib/atlas-motion.ts`, this subscribes to the
 * media query so components re-render if the user toggles the OS setting while
 * the page is open. SSR-safe: returns `false` until mounted on the client.
 *
 * Used by the heritage-museum XR views to honour WCAG 2.2 "Animation from
 * Interactions" / "Motion" expectations — auto-advancing story beats, Ken Burns
 * pans, and panorama auto-rotation are all suppressed when reduced motion is on.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
