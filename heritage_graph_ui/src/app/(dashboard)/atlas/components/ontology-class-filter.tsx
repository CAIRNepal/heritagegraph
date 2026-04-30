'use client';

import { IconAdjustments } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ONTOLOGY_CLASSES } from '@/types/atlas';

import { useAtlasStore } from '../hooks/use-atlas-store';

export function OntologyClassFilter({
  className,
  dense = false,
}: {
  className?: string;
  /** Icon + count only; compact height for timeline dock. */
  dense?: boolean;
}) {
  const t = useTranslations('Atlas');
  const classEnabled = useAtlasStore((s) => s.classEnabled);
  const toggleClass = useAtlasStore((s) => s.toggleClass);

  const enabledCount = ONTOLOGY_CLASSES.filter((c) => classEnabled[c]).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={[
            'pointer-events-auto gap-2 rounded-full border-border/60 bg-background/70 backdrop-blur-md',
            dense ? 'h-6 gap-1 px-2 text-[10px]' : 'h-9 text-xs',
            className ?? '',
          ].join(' ')}
          title={dense ? t('filterByClass') : undefined}
        >
          <IconAdjustments className={dense ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
          {dense ? (
            <span className="font-mono tabular-nums">{enabledCount}</span>
          ) : (
            <>
              {t('ontologyClasses')} ({enabledCount})
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="border-b border-border px-3 py-2 text-xs font-semibold">{t('filterByClass')}</div>
        <ScrollArea className="max-h-64">
          <div className="flex flex-col gap-2 p-3">
            {ONTOLOGY_CLASSES.map((c) => (
              <div key={c} className="flex items-center gap-2">
                <Checkbox
                  id={`class-${c}`}
                  checked={classEnabled[c]}
                  onCheckedChange={() => toggleClass(c)}
                />
                <Label htmlFor={`class-${c}`} className="cursor-pointer font-mono text-[11px] leading-tight">
                  {c}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
