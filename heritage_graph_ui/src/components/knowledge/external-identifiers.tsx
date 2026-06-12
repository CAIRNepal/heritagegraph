"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Linked-data authorities → display label + URL resolver. Values may already be
// full URLs (used as-is) or bare identifiers (expanded per scheme).
const SCHEME_META: Record<string, { label: string; url: (v: string) => string }> = {
  wikidata: { label: "Wikidata", url: (v) => `https://www.wikidata.org/wiki/${v}` },
  viaf: { label: "VIAF", url: (v) => `https://viaf.org/viaf/${v}` },
  geonames: { label: "GeoNames", url: (v) => `https://www.geonames.org/${v}` },
  ulan: { label: "Getty ULAN", url: (v) => `https://vocab.getty.edu/page/ulan/${v}` },
  aat: { label: "Getty AAT", url: (v) => `https://vocab.getty.edu/page/aat/${v}` },
  tgn: { label: "Getty TGN", url: (v) => `https://vocab.getty.edu/page/tgn/${v}` },
  getty: { label: "Getty", url: (v) => `https://vocab.getty.edu/page/ulan/${v}` },
  loc: { label: "Library of Congress", url: (v) => `https://id.loc.gov/authorities/${v}` },
  gnd: { label: "GND", url: (v) => `https://d-nb.info/gnd/${v}` },
};

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

function schemeLabel(scheme: string): string {
  return SCHEME_META[scheme.toLowerCase()]?.label ?? scheme.replace(/_/g, " ");
}

function resolveUrl(scheme: string, value: string): string | null {
  if (isUrl(value)) return value;
  const meta = SCHEME_META[scheme.toLowerCase()];
  return meta ? meta.url(value) : null;
}

interface IdEntry {
  scheme: string;
  value: string;
  url: string | null;
}

/**
 * Renders an entity's linked-open-data identifiers (Wikidata/Getty/VIAF/…) and
 * any external canonical record (e.g. a Yale LUX `externalUri`) as linked badges
 * — the discoverability layer expected of a research-grade record.
 */
export function ExternalIdentifiers({
  ids,
  externalUri,
  className,
}: {
  ids?: Record<string, unknown> | null;
  externalUri?: string | null;
  className?: string;
}) {
  const entries: IdEntry[] = [];
  if (ids && typeof ids === "object" && !Array.isArray(ids)) {
    for (const [k, v] of Object.entries(ids)) {
      if (v == null || v === "") continue;
      const value = String(v);
      entries.push({ scheme: k, value, url: resolveUrl(k, value) });
    }
  }
  if (externalUri && typeof externalUri === "string") {
    entries.push({ scheme: "Linked record", value: externalUri, url: externalUri });
  }
  if (entries.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {entries.map((e, i) => {
        const display =
          e.scheme === "Linked record" ? "Linked record" : `${schemeLabel(e.scheme)}: ${e.value}`;
        if (e.url) {
          return (
            <a key={`${e.scheme}-${i}`} href={e.url} target="_blank" rel="noopener noreferrer">
              <Badge
                variant="outline"
                className="max-w-[16rem] gap-1 truncate hover:bg-accent hover:text-accent-foreground"
                title={e.url}
              >
                <span className="truncate">{display}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </Badge>
            </a>
          );
        }
        return (
          <Badge key={`${e.scheme}-${i}`} variant="outline" className="max-w-[16rem] truncate" title={e.value}>
            {display}
          </Badge>
        );
      })}
    </div>
  );
}
