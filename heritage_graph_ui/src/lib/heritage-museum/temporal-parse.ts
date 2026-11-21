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

const CENTURY_RE =
  /(\d{1,2})(?:st|nd|rd|th)?\s+century\s+(BCE|BC|CE|AD)/i;

export function parseTemporalAnchor(raw: string | undefined | null): TemporalAnchor | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const uncertain = UNCERTAIN_PREFIX.test(s);

  const century = s.match(CENTURY_RE);
  if (century) {
    const ordinal = parseInt(century[1], 10);
    const era = century[2].toUpperCase();
    if (Number.isFinite(ordinal) && ordinal > 0 && ordinal < 100) {
      const mid = ordinal * 100 - 50;
      const year = era === 'BCE' || era === 'BC' ? -mid : mid;
      const abs = Math.abs(year);
      const eraLabel = year < 0 ? 'BCE' : 'CE';
      const core = `${ordinal}${ordinalSuffix(ordinal)} century ${eraLabel} (~${abs} ${eraLabel})`;
      const displayLabel = uncertain ? `c. ${core}` : core;
      return { year, uncertain: uncertain || true, displayLabel, raw: s };
    }
  }

  const bce = s.match(/(-?\d{1,4})\s*(BCE|BC)\b/i);
  if (bce) {
    const abs = Math.abs(parseInt(bce[1], 10));
    const year = -abs;
    const core = `${abs} BCE`;
    const displayLabel = uncertain ? `c. ${core}` : core;
    return { year, uncertain, displayLabel, raw: s };
  }

  const ce = s.match(/(-?\d{1,4})\s*(CE|AD)\b/i);
  if (ce) {
    const year = parseInt(ce[1], 10);
    if (!Number.isFinite(year)) return null;
    const core = `${Math.abs(year)} CE`;
    const displayLabel = uncertain ? `c. ${core}` : core;
    return { year, uncertain, displayLabel, raw: s };
  }

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

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
