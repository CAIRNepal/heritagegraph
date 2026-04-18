"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function OcrSuggestionBadge({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const tone =
    pct >= 80 ? "default" : pct >= 50 ? "secondary" : "outline";
  return (
    <Badge variant={tone} className={cn("font-mono tabular-nums", className)}>
      {pct}%
    </Badge>
  );
}
