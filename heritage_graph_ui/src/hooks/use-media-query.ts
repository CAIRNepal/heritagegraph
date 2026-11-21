'use client';

import { useEffect, useState } from 'react';

/**
 * Whether a media query matches.
 *
 * Starts `true` so the wide layout renders on the server and on first paint;
 * a phone corrects it after mount. Starting `false` would flash the narrow
 * layout on every desktop load, which is the common case for this site.
 */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(true);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const sync = () => setMatch(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, [query]);
  return match;
}
