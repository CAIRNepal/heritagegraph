// =================================================================
// Heritage date formatting helpers (EDTF / ISO 8601-2)
// =================================================================
// Heritage dates are frequently imprecise. We accept EDTF-style strings
// (a year, a range/century, an approximate year, or an exact day) and
// explain that to laymen in one plain-language legend.
//
// Quick-picks are locale-neutral by default. A deployment can override them
// via NEXT_PUBLIC_DATE_QUICKPICKS (JSON array of {label,value}) to add a
// local calendar — e.g. [{"label":"NS 1140","value":"NS1140"}] for Nepal —
// without touching code.
// =================================================================

export interface DateQuickPick {
  label: string;
  value: string;
}

/** Plain-language legend shown under heritage date inputs. */
export const DATE_FORMAT_LEGEND =
  "Year: 1857 · Range or century: 1200/1300 · Approximate: 1857~ · Exact day: 1975-05-01. Leaving the month and day out is fine.";

let _cached: DateQuickPick[] | null = null;

/** Locale-neutral quick-picks, overridable per deployment via env. */
export function getDateQuickPicks(): DateQuickPick[] {
  if (_cached) return _cached;
  const raw = process.env.NEXT_PUBLIC_DATE_QUICKPICKS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const picks = parsed.filter(
          (p): p is DateQuickPick =>
            !!p &&
            typeof (p as DateQuickPick).label === "string" &&
            typeof (p as DateQuickPick).value === "string",
        );
        if (picks.length) {
          _cached = picks;
          return picks;
        }
      }
    } catch {
      /* fall through to defaults */
    }
  }
  const y = new Date().getFullYear();
  _cached = [
    { label: "This year", value: String(y) },
    { label: "20th century", value: "1900/1999" },
    { label: "19th century", value: "1800/1899" },
    { label: "Approximate", value: `${y}~` },
  ];
  return _cached;
}
