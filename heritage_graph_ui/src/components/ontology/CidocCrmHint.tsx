"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const prefix = raw.slice(0, idx);
  const local = raw.slice(idx + 1);
  const base = PREFIX_TO_BASE[prefix];
  if (!base) return null;
  return `${base}${local}`;
}

export function CidocCrmHint({
  slotUri,
  className,
}: {
  slotUri?: string;
  className?: string;
}) {
  const compact = (slotUri || "").trim();

  const fullUri = useMemo(() => {
    if (!compact) return null;
    return resolveCurieToUri(compact) || compact;
  }, [compact]);

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!fullUri) return;
    try {
      await navigator.clipboard.writeText(fullUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permissions can fail; keep UX silent.
    }
  }, [fullUri]);

  if (!compact) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-xs text-muted-foreground font-mono leading-none hover:text-foreground transition-colors",
            "max-w-[45%] truncate",
            className
          )}
          aria-label={`CIDOC term: ${compact}`}
        >
          {compact}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[min(520px,calc(100vw-2rem))]">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">CIDOC-CRM term</div>
            <div className="font-mono text-xs break-all">{fullUri || compact}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy URI"}
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

