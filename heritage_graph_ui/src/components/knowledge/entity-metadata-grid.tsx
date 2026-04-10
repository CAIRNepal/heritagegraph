"use client";

import type { ReactNode } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OntologyClass, OntologyField } from "@/lib/ontology";
import { formatFieldValue } from "@/lib/knowledge/entity-view-utils";
import { cn } from "@/lib/utils";

interface SectionSpec {
  key: string;
  label: string;
  description?: string;
}

function renderValue(
  field: OntologyField,
  value: unknown,
  formatted: string,
): ReactNode {
  if (field.type === "url" && typeof value === "string") {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 break-all text-primary hover:underline"
      >
        {value}
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    );
  }
  if (field.type === "coordinates" && typeof value === "string") {
    return (
      <span className="inline-flex items-center gap-1">
        <MapPin className="h-3 w-3 shrink-0 text-primary" />
        {value}
      </span>
    );
  }
  if (field.type === "select" && field.options) {
    return (
      <Badge variant="secondary">
        {field.options.find((o) => o.value === String(value))?.label || formatted}
      </Badge>
    );
  }
  return <span className="whitespace-pre-wrap">{formatted}</span>;
}

type GridRow =
  | { kind: "section"; label: string; description?: string }
  | { kind: "field"; field: OntologyField; value: unknown };

interface EntityMetadataGridProps {
  ontologyClass: OntologyClass;
  record: Record<string, unknown>;
  sections: SectionSpec[];
  fieldsBySection: Record<string, OntologyField[]>;
  className?: string;
}

export function EntityMetadataGrid({
  ontologyClass,
  record,
  sections,
  fieldsBySection,
  className,
}: EntityMetadataGridProps) {
  const knownKeys = new Set([
    ...ontologyClass.fields.map((f) => f.key),
    "id",
    "status",
    "category",
    "contributor",
    "created_at",
    "updated_at",
    "cultural_entity_id",
    "entity_id",
  ]);

  const rows: GridRow[] = [];

  for (const section of sections) {
    const fields = fieldsBySection[section.key] || [];
    const withValues = fields.filter((f) => {
      const val = record[f.key];
      return val !== null && val !== undefined && val !== "";
    });
    if (withValues.length === 0) continue;
    rows.push({ kind: "section", label: section.label, description: section.description });
    for (const field of withValues) {
      rows.push({ kind: "field", field, value: record[field.key] });
    }
  }

  const extraEntries = Object.entries(record).filter(
    ([k, v]) => !knownKeys.has(k) && v !== null && v !== undefined && v !== "" && !k.startsWith("_"),
  );
  if (extraEntries.length > 0) {
    rows.push({ kind: "section", label: "Additional information" });
    for (const [key, value] of extraEntries) {
      rows.push({
        kind: "field",
        field: {
          key,
          label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          type: "text",
        } as OntologyField,
        value,
      });
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        No fields to display.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/40 px-4 py-5 sm:px-6",
        className,
      )}
    >
      <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
        {rows.map((row, i) => {
          if (row.kind === "section") {
            return (
              <div
                key={`s-${row.label}-${i}`}
                className="col-span-full border-t border-border/50 pt-5 first:border-t-0 first:pt-0"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {row.label}
                </h3>
                {row.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>
                ) : null}
              </div>
            );
          }
          const formatted = formatFieldValue(row.value, row.field);
          const fromOntology = ontologyClass.fields.some((f) => f.key === row.field.key);
          return (
            <div key={row.field.key + String(i)} className="min-w-0 space-y-1">
              <dt className="text-xs font-medium text-muted-foreground">{row.field.label}</dt>
              <dd className="text-sm text-foreground">
                {fromOntology ? (
                  renderValue(row.field, row.value, formatted)
                ) : (
                  <span className="whitespace-pre-wrap break-words">{formatted}</span>
                )}
              </dd>
            </div>
          );
        })}
      </div>
    </div>
  );
}
