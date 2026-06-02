/**
 * Parse heritage node inception / founding strings into a display anchor.
 * Aligns with EDTF-style prefixes (c., ca., circa) used in the demo corpus.
 */

export interface TemporalAnchor {
  year: number;
  uncertain: boolean;
  /** Human-readable axis label, e.g. "c. 1200 CE". */
  displayLabel: string;
  raw: string;
}

const UNCERTAIN_PREFIX =
  /^(\s*c\.?\s*|circa\s*|ca\.?\s*|~|approx\.?\s*|approximately\s*)/i;

export function parseTemporalAnchor(raw: string | undefined | null): TemporalAnchor | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const uncertain = UNCERTAIN_PREFIX.test(s);
  const m = s.match(/(-?\d{1,4})/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  if (!Number.isFinite(year)) return null;

  const abs = Math.abs(year);
  const era = year < 0 ? 'BCE' : 'CE';
  const core = `${abs} ${era}`;
  const displayLabel = uncertain ? `c. ${core}` : core;

  return { year, uncertain, displayLabel, raw: s };
}
