'use client';

import { IconAlertTriangle, IconCircleCheck, IconHelp } from '@tabler/icons-react';

import { cn } from '@/lib/utils';
import type { HeritageAssertion, ReliabilityTier } from '@/types/atlas';

interface ProvenanceBadgeProps {
  assertion?: HeritageAssertion | null;
  tier?: ReliabilityTier | null;
  compact?: boolean;
  className?: string;
}

export function ProvenanceBadge({
  assertion,
  tier,
  compact,
  className,
}: ProvenanceBadgeProps) {
  const tierLetter = tier ?? '—';
  const pct =
    assertion != null ? `${Math.round(assertion.confidenceScore * 100)}%` : undefined;

  const Icon =
    assertion?.reconciliationStatus === 'conflicting' ? IconAlertTriangle
    : assertion?.reconciliationStatus === 'unverified' ? IconHelp
    : IconCircleCheck;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground',
        compact && 'px-1 py-0 text-[9px]',
        className,
      )}
      title={assertion?.assertedProperty}
    >
      <span className="font-semibold text-foreground">{tierLetter}</span>
      {pct ? <span>{pct}</span> : null}
      <Icon className="h-3 w-3 shrink-0 text-foreground" aria-hidden />
    </span>
  );
}
