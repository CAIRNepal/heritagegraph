"use client";

import { cn } from "@/lib/utils";

interface Level {
  label: string;
  pct: number;
  color: string;
}

const NAMED_LEVELS: Record<string, Level> = {
  certain: { label: "Certain", pct: 100, color: "bg-emerald-500" },
  high: { label: "High confidence", pct: 90, color: "bg-emerald-500" },
  likely: { label: "Likely", pct: 75, color: "bg-emerald-500" },
  medium: { label: "Medium confidence", pct: 55, color: "bg-amber-500" },
  uncertain: { label: "Uncertain", pct: 40, color: "bg-amber-500" },
  low: { label: "Low confidence", pct: 30, color: "bg-orange-500" },
  speculative: { label: "Speculative", pct: 18, color: "bg-red-500" },
  unverified: { label: "Unverified", pct: 25, color: "bg-orange-500" },
};

function resolveLevel(value: string | number | null | undefined): Level | null {
  if (value == null || value === "") return null;
  // Numeric 0..1 (or 0..100) confidence score.
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isNaN(num) && /^[\d.]+$/.test(String(value).trim())) {
    const pct = num <= 1 ? num * 100 : num;
    const color = pct >= 70 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-500" : "bg-orange-500";
    return { label: `${Math.round(pct)}% confidence`, pct: Math.max(6, Math.min(100, pct)), color };
  }
  return NAMED_LEVELS[String(value).trim().toLowerCase()] ?? {
    label: String(value),
    pct: 50,
    color: "bg-muted-foreground",
  };
}

/**
 * Compact visual confidence indicator (a filled bar + label) so epistemic
 * strength is scannable, not buried in a text badge.
 */
export function ConfidenceIndicator({
  value,
  className,
}: {
  value: string | number | null | undefined;
  className?: string;
}) {
  const level = resolveLevel(value);
  if (!level) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={level.label}
      aria-label={level.label}
    >
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", level.color)}
          style={{ width: `${level.pct}%` }}
        />
      </span>
      <span className="text-[10px] text-muted-foreground">{level.label}</span>
    </span>
  );
}
