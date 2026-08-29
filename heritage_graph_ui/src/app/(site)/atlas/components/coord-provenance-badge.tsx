'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AtlasCoordProvenance } from '@/types/atlas';

const STYLE: Record<AtlasCoordProvenance, string> = {
  verified:
    'border-green-600/50 text-green-700 dark:text-green-400 bg-green-500/10',
  gazetteer:
    'border-amber-600/50 text-amber-800 dark:text-amber-300 bg-amber-500/10',
  inherited:
    'border-primary/30 text-primary dark:text-primary bg-primary/10',
  unmapped:
    'border-border text-muted-foreground bg-muted/40',
};

interface CoordProvenanceBadgeProps {
  provenance: AtlasCoordProvenance;
  compact?: boolean;
  className?: string;
}

export function CoordProvenanceBadge({
  provenance,
  compact = false,
  className,
}: CoordProvenanceBadgeProps) {
  const t = useTranslations('Atlas');

  const labelKey =
    provenance === 'verified' ? 'coordVerified'
    : provenance === 'gazetteer' ? 'coordGazetteer'
    : provenance === 'inherited' ? 'coordInherited'
    : 'coordUnmapped';

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono uppercase tracking-wide',
        compact ? 'text-[9px] px-1 py-0' : 'text-[10px]',
        STYLE[provenance],
        className,
      )}
      title={t(`${labelKey}Hint`)}
    >
      {t(labelKey)}
    </Badge>
  );
}
