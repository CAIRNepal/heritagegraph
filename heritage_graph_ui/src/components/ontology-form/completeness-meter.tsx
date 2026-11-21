"use client";

import { Progress } from "@/components/ui/progress";
import type { OntologyClass } from "@/lib/ontology/types";
import { isEmptyOntologyFieldValue } from "@/lib/ontology/useValidation";

export function computeOntologyFormCompleteness(
  ontologyClass: OntologyClass,
  values: Record<string, unknown>
): {
  /** 0–100 blended score */
  percent: number;
  requiredFilled: number;
  requiredTotal: number;
  weightedOptionalFilled: number;
  weightedOptionalTotal: number;
} {
  const requiredFields = ontologyClass.fields.filter((f) => f.required);
  const requiredFilled = requiredFields.filter(
    (f) => !isEmptyOntologyFieldValue(f, values[f.key])
  ).length;
  const requiredTotal = requiredFields.length;
  const requiredPct =
    requiredTotal === 0 ? 100 : (requiredFilled / requiredTotal) * 100;

  let weightedOptionalFilled = 0;
  let weightedOptionalTotal = 0;
  for (const f of ontologyClass.fields) {
    if (f.required) continue;
    const w = f.ui_weight;
    if (w === undefined || w === null || w <= 0) continue;
    weightedOptionalTotal += w;
    if (!isEmptyOntologyFieldValue(f, values[f.key])) {
      weightedOptionalFilled += w;
    }
  }
  const optionalPct =
    weightedOptionalTotal === 0
      ? 100
      : (weightedOptionalFilled / weightedOptionalTotal) * 100;

  const percent = Math.round(
    requiredTotal > 0 ? 0.72 * requiredPct + 0.28 * optionalPct : optionalPct
  );

  return {
    percent: Math.min(100, Math.max(0, percent)),
    requiredFilled,
    requiredTotal,
    weightedOptionalFilled,
    weightedOptionalTotal,
  };
}

export function CompletenessMeter({
  ontologyClass,
  values,
}: {
  ontologyClass: OntologyClass;
  values: Record<string, unknown>;
}) {
  const c = computeOntologyFormCompleteness(ontologyClass, values);
  return (
    <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Completeness</span>
        <span className="font-medium text-foreground tabular-nums">{c.percent}%</span>
      </div>
      <Progress value={c.percent} className="h-2" />
      <p className="text-[11px] text-muted-foreground">
        {c.requiredTotal > 0 ? (
          <>
            Required: {c.requiredFilled}/{c.requiredTotal}
            {c.weightedOptionalTotal > 0
              ? ` · Weighted optional: ${c.weightedOptionalFilled}/${c.weightedOptionalTotal}`
              : null}
          </>
        ) : (
          "Add details to improve your contribution score."
        )}
      </p>
    </div>
  );
}
