"use client";

/**
 * Live preview of a contribution as it would appear in the Heritage Atlas.
 *
 * Updates per keystroke so the contributor sees their entity materialize as
 * they type — the IKEA effect (Norton, Mochon, Ariely 2012) and competence
 * feedback (Self-Determination Theory) wrapped in one small card.
 *
 * Purely presentational: no fetch, no side effects, safe to render in any
 * column layout the parent provides.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";

import type { OntologyClass, OntologyField } from "@/lib/ontology/types";
import { inferRootLabel } from "@/lib/ontology/form-graph";
import { cn } from "@/lib/utils";

interface PreviewCardProps {
  ontologyClass: OntologyClass;
  formData: Record<string, unknown>;
  /** Display name to credit at the bottom; usually session?.user?.name. */
  contributorName?: string | null;
  /** 0-100. Drives the readiness bar + readiness wording. */
  progressPercent: number;
}

const MAX_DESC_CHARS = 220;
const MAX_CHIPS = 4;

/** Pull a short, human-readable string from a form value of unknown shape. */
function stringify(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => stringify(v))
      .filter((s): s is string => Boolean(s));
    return parts.length ? parts.slice(0, 3).join(" · ") : null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === "string" && obj.name.trim()) return obj.name.trim();
    if (typeof obj.label === "string" && obj.label.trim()) return obj.label.trim();
    if (typeof obj.title === "string" && obj.title.trim()) return obj.title.trim();
    if (typeof obj.id === "string" || typeof obj.id === "number") {
      return `#${String(obj.id)}`;
    }
  }
  return null;
}

function inferDescription(
  ontologyClass: OntologyClass,
  formData: Record<string, unknown>
): string | null {
  const prefer = ["description", "note", "abstract", "summary", "biography"];
  for (const key of prefer) {
    const v = formData[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const f of ontologyClass.fields) {
    if (f.type !== "textarea") continue;
    if (f.key === "name" || f.key === "title") continue;
    const v = formData[f.key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Pick interesting *non-name, non-description* fields to render as chips. */
function selectChipFields(
  ontologyClass: OntologyClass,
  formData: Record<string, unknown>
): Array<{ field: OntologyField; display: string }> {
  const skip = new Set(["name", "title", "description", "note", "summary", "biography"]);
  const out: Array<{ field: OntologyField; display: string }> = [];
  for (const f of ontologyClass.fields) {
    if (skip.has(f.key)) continue;
    const v = formData[f.key];
    const display = stringify(v);
    if (!display) continue;
    out.push({ field: f, display });
    if (out.length >= MAX_CHIPS) break;
  }
  return out;
}

function readinessLabel(percent: number): string {
  if (percent >= 100) return "Ready to submit";
  if (percent >= 80) return "Almost ready";
  if (percent >= 50) return "Coming together";
  if (percent >= 20) return "Getting started";
  return "Just beginning";
}

export function OntologyFormPreviewCard({
  ontologyClass,
  formData,
  contributorName,
  progressPercent,
}: PreviewCardProps) {
  const rootLabel = useMemo(
    () => inferRootLabel(ontologyClass, formData) ?? null,
    [ontologyClass, formData]
  );
  const description = useMemo(
    () => inferDescription(ontologyClass, formData),
    [ontologyClass, formData]
  );
  const chips = useMemo(
    () => selectChipFields(ontologyClass, formData),
    [ontologyClass, formData]
  );

  // Lightly clamp the readiness bar so 0% never looks abandoned (endowed
  // progress effect — Nunes & Drèze 2006). The form's own meter still shows
  // the literal value; this is only for the preview's tone.
  const displayedPercent = Math.max(8, Math.min(100, Math.round(progressPercent)));
  const isEmpty = !rootLabel && !description && chips.length === 0;

  return (
    <motion.aside
      // Reveal the preview softly so it doesn't compete with the form.
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-2xl border border-blue-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/80"
      aria-label="Live preview of your contribution"
    >
      {/* Top strip: class chip + PREVIEW tag */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
          {ontologyClass.label}
        </span>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          Preview
        </span>
      </div>

      {/* Body */}
      <div className="space-y-3 px-4 py-4">
        <div>
          <h3
            className={cn(
              "text-lg font-semibold leading-tight",
              rootLabel
                ? "text-foreground"
                : "italic text-muted-foreground"
            )}
          >
            {rootLabel ?? "Your contribution"}
          </h3>
          <div className="mt-1.5 h-0.5 w-12 rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-400" />
        </div>

        {description ? (
          <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
            {description.length > MAX_DESC_CHARS
              ? description.slice(0, MAX_DESC_CHARS).trimEnd() + "…"
              : description}
          </p>
        ) : isEmpty ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Start typing — this is how your contribution will appear in the
            knowledge graph.
          </p>
        ) : null}

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {chips.map(({ field, display }) => (
              <span
                key={field.key}
                className="inline-flex max-w-[14rem] items-center gap-1 truncate rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
                title={`${field.label}: ${display}`}
              >
                <span className="text-muted-foreground">{field.label}:</span>
                <span className="font-medium truncate">{display}</span>
              </span>
            ))}
          </div>
        ) : null}

        {isEmpty ? (
          <p className="rounded-md bg-blue-50/60 px-2.5 py-1.5 text-[11px] text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            Tip · Begin with a name. The rest will follow.
          </p>
        ) : null}
      </div>

      {/* Footer: readiness + attribution */}
      <div className="space-y-2 border-t border-border/60 px-4 py-3">
        <div>
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
            <span>{readinessLabel(progressPercent)}</span>
            <span className="tabular-nums">{Math.round(progressPercent)}%</span>
          </div>
          <div
            className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(progressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-400 transition-[width] duration-500 ease-out"
              style={{ width: `${displayedPercent}%` }}
            />
          </div>
        </div>
        {contributorName ? (
          <p className="text-[11px] text-muted-foreground">
            Contributed by <span className="font-medium">{contributorName}</span>
          </p>
        ) : null}
      </div>
    </motion.aside>
  );
}
