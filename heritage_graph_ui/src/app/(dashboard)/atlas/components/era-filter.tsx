'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { AtlasEra } from '@/types/atlas';

import { ATLAS_ERAS_ORDER, useAtlasStore } from '../hooks/use-atlas-store';

const ERA_MSG_KEY: Record<AtlasEra, 'eraAncient' | 'eraMedieval' | 'eraEarlyModern' | 'eraModern'> =
  {
    ancient: 'eraAncient',
    medieval: 'eraMedieval',
    early_modern: 'eraEarlyModern',
    modern: 'eraModern',
  };

const ERA_NE_KEY: Record<AtlasEra, 'eraAncientNe' | 'eraMedievalNe' | 'eraEarlyModernNe' | 'eraModernNe'> =
  {
    ancient: 'eraAncientNe',
    medieval: 'eraMedievalNe',
    early_modern: 'eraEarlyModernNe',
    modern: 'eraModernNe',
  };

const SHORT: Record<AtlasEra, string> = {
  ancient: 'A',
  medieval: 'M',
  early_modern: 'EM',
  modern: 'Mo',
};

interface EraFilterProps {
  className?: string;
  /** Compact chips for timeline dock (h-6, smaller text). */
  dense?: boolean;
}

export function EraFilter({ className, dense = false }: EraFilterProps) {
  const t = useTranslations('Atlas');
  const eraEnabled = useAtlasStore((s) => s.eraEnabled);
  const toggleEra = useAtlasStore((s) => s.toggleEra);

  const chipClass = dense ?
    'pointer-events-auto h-6 rounded-full px-2 text-[10px] backdrop-blur-md bg-background/70'
  : 'pointer-events-auto h-8 rounded-full px-3 text-xs backdrop-blur-md bg-background/70';

  return (
    <div
      className={[dense ? 'flex flex-wrap gap-1' : 'flex flex-wrap gap-1.5', className ?? ''].join(' ')}
    >
      {ATLAS_ERAS_ORDER.map((era) => (
        <Button
          key={era}
          size="sm"
          variant={eraEnabled[era] ? 'default' : 'outline'}
          className={chipClass}
          onClick={() => toggleEra(era)}
          type="button"
          title={`${t(ERA_MSG_KEY[era])} · ${t(ERA_NE_KEY[era])}`}
          aria-label={`${t(ERA_MSG_KEY[era])}, ${t(ERA_NE_KEY[era])}`}
        >
          <span className="flex flex-col items-start leading-tight">
            <span className={dense ? 'inline' : 'hidden sm:inline'}>{t(ERA_MSG_KEY[era])}</span>
            <span className="hidden text-[9px] font-normal normal-case text-muted-foreground sm:inline">
              {t(ERA_NE_KEY[era])}
            </span>
          </span>
          {!dense ?
            <span className="sm:hidden">{SHORT[era]}</span>
          : null}
        </Button>
      ))}
    </div>
  );
}
