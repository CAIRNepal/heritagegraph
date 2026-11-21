"use client";

import React, { useCallback, useMemo, useState } from "react";
import { HelpCircle, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const PREFIX_TO_BASE: Record<string, string> = {
  crm: "http://www.cidoc-crm.org/cidoc-crm/",
  prov: "http://www.w3.org/ns/prov#",
  time: "http://www.w3.org/2006/time#",
  geo: "http://www.opengis.net/ont/geosparql#",
};

function resolveCurieToUri(curieOrUri: string): string | null {
  const raw = (curieOrUri || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  const base = PREFIX_TO_BASE[raw.slice(0, idx)];
  return base ? `${base}${raw.slice(idx + 1)}` : null;
}

/**
 * Plain-language "What's this?" affordance for a form field. Shows the
 * layman-friendly `help` text first; the CIDOC-CRM term (if any) is tucked
 * under a quiet "For experts" footer so jargon never leads.
 */
export function FieldHelpHint({
  help,
  slotUri,
  label,
  className,
}: {
  help?: string;
  slotUri?: string;
  label?: string;
  className?: string;
}) {
  const compact = (slotUri || "").trim();
  const fullUri = useMemo(
    () => (compact ? resolveCurieToUri(compact) || compact : null),
    [compact],
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!fullUri) return;
    try {
      await navigator.clipboard.writeText(fullUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard permissions can fail; keep UX silent */
    }
  }, [fullUri]);

  // Nothing useful to show.
  if (!help && !compact) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-muted-foreground/70 hover:text-foreground transition-colors",
            className,
          )}
          aria-label={label ? `What is "${label}"?` : "What's this?"}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={6}
        className="max-w-[min(360px,calc(100vw-2rem))] text-sm"
      >
        {label ? <div className="font-medium mb-1">{label}</div> : null}
        {help ? (
          <p className="text-muted-foreground leading-relaxed">{help}</p>
        ) : (
          <p className="text-muted-foreground leading-relaxed">
            This field maps to a standard heritage-ontology term.
          </p>
        )}
        {compact ? (
          <div className="mt-3 border-t pt-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
              For experts (CIDOC-CRM)
            </div>
            <div className="mt-1 flex items-start gap-2">
              <code className="font-mono text-xs break-all text-muted-foreground">
                {fullUri || compact}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={handleCopy}
                aria-label={copied ? "Copied" : "Copy URI"}
                title={copied ? "Copied" : "Copy"}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
