import type { OntologyClass, OntologyField } from "@/lib/ontology";

export interface ContributorPresentation {
  label: string;
  email?: string;
  initials: string;
}

export function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

export function formatStatusLabel(raw: string) {
  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function formatFieldValue(value: unknown, field?: OntologyField): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export function contributorFromRecord(record: Record<string, unknown>): ContributorPresentation | null {
  const c = record.contributor;
  if (c === null || c === undefined) return null;
  if (typeof c === "string") {
    const label = c.trim();
    if (!label) return null;
    const parts = label.split(/\s+/).filter(Boolean);
    let initials: string;
    if (parts.length >= 2) {
      initials = `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
    } else if (label.length >= 2) {
      initials = label.slice(0, 2).toUpperCase();
    } else {
      initials = (label[0] ?? "?").toUpperCase();
    }
    return { label, initials: initials || "?" };
  }
  if (typeof c === "object") {
    const o = c as { username?: string; first_name?: string; last_name?: string; email?: string };
    const label =
      [o.first_name, o.last_name].filter(Boolean).join(" ").trim() ||
      (typeof o.username === "string" ? o.username.trim() : "") ||
      "";
    const email = typeof o.email === "string" ? o.email.trim() : undefined;
    if (!label && !email) return null;
    const initials = (o.first_name?.[0] || o.username?.[0] || label[0] || "?").toUpperCase();
    return {
      label: label || o.username || "Unknown",
      email: email || undefined,
      initials,
    };
  }
  return null;
}

export function authorNamesFromRecord(record: Record<string, unknown>): string[] {
  const a = record.authors;
  if (typeof a !== "string" || !a.trim()) return [];
  return a
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function publicationYearFromRecord(record: Record<string, unknown>): string | null {
  const y = record.publication_year ?? record.publicationYear ?? record.year;
  if (typeof y === "number" && Number.isFinite(y)) return String(y);
  if (typeof y === "string" && y.trim()) return y.trim();
  return null;
}

/** Inline subtitle segments: type, authors, year, contributor — joined with · in the UI. */
export function buildEntitySubtitleParts(
  record: Record<string, unknown>,
  ontologyClass: OntologyClass,
  authorNames: string[],
  category: string | undefined,
): string[] {
  const parts: string[] = [];
  const seen = new Set<string>();

  for (const f of ontologyClass.fields) {
    if (f.type !== "select" || !f.options) continue;
    if (f.key !== "source_type" && f.key !== "type" && f.key !== "source_kind") continue;
    const v = record[f.key];
    if (v === null || v === undefined || v === "") continue;
    const label = f.options.find((o) => o.value === String(v))?.label ?? String(v);
    if (!seen.has(label)) {
      parts.push(label);
      seen.add(label);
    }
  }

  const cat = category?.trim();
  if (cat && !seen.has(cat)) {
    parts.push(cat);
    seen.add(cat);
  }

  if (authorNames.length === 1) {
    parts.push(authorNames[0]!);
  } else if (authorNames.length > 1) {
    parts.push(`Authors: ${authorNames.join(", ")}`);
  }

  const y = publicationYearFromRecord(record);
  if (y) parts.push(`Published ${y}`);

  return parts;
}
