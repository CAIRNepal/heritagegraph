'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { useAtlasStore } from '../hooks/use-atlas-store';

function heuristicAnswer(q: string): { text: string; ids: string[] } {
  const p = q.trim().toLowerCase();
  if (!p) return { text: '', ids: [] };
  if (p.includes('guthi') && p.includes('stupa')) {
    return {
      text:
        'Heuristic dummy: Guthi stewardships frequently intersect with stupa precinct custodial schedules in this corpus. Cross-check holds_custody_of edges against festival calendars.',
      ids: ['ent-guthi-pashupati', 'ent-boudhanath'],
    };
  }
  if (p.includes('conflict') || p.includes('assert')) {
    return {
      text:
        'Heuristic dummy: Assertions flagged reconciliation_status=conflicting appear when Wikipedia-tier sources disagree with archive-backed rows — inspect supersedes_assertion chains.',
      ids: ['ent-pashupatinath', 'ent-boudhanath'],
    };
  }
  if (p.includes('kumari') || p.includes('living goddess')) {
    return {
      text:
        'Heuristic dummy: LivingGoddessTenure bundles residence_structure + embodied_deity + had_participant — inspect Kumari Ghar entity cluster.',
      ids: ['ent-kumari-tenure-sample', 'ent-kumari-ghar'],
    };
  }
  return {
    text:
      'Heuristic dummy: broaden query with keywords like Guthi, festival, earthquake-2015, or provenance. No LLM call — deterministic stub until assistant API is wired.',
    ids: ['ent-earthquake-2015'],
  };
}

interface AiReasoningViewProps {
  compact?: boolean;
}

export function AiReasoningView({ compact = false }: AiReasoningViewProps) {
  const t = useTranslations('Atlas');
  const entities = useAtlasStore((s) => s.entities);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const focusView = useAtlasStore((s) => s.focusView);

  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState<{ text: string; ids: string[] } | null>(null);

  const chips = useMemo(
    () => [
      t('aiChipGuthiStupa'),
      t('aiChipConflicts'),
      t('aiChipKumari'),
    ],
    [t],
  );

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-3',
        compact ? 'h-full px-1 pb-1' : 'px-2 pb-2 md:pl-16 md:pr-2 md:pt-14',
      )}
    >
      <div
        className={cn(
          'rounded-xl border border-border/60 bg-background/75 backdrop-blur-md',
          compact ? 'p-2' : 'p-3',
        )}
      >
        <p className="font-mono text-[10px] uppercase tracking-wide text-destructive">{t('aiDisclaimer')}</p>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('aiPlaceholder')}
          className={cn('mt-2 font-mono text-sm', compact ? 'min-h-[64px]' : 'min-h-[88px]')}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => setAnswer(heuristicAnswer(prompt))}>
            {t('aiRun')}
          </Button>
          {chips.map((c) => (
            <Button
              key={c}
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setPrompt(c);
                setAnswer(heuristicAnswer(c));
              }}
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {answer ?
        <ScrollArea
          className={cn(
            'min-h-[160px] flex-1 rounded-xl border border-border/60 bg-muted/25 backdrop-blur-md',
            compact ? 'p-2' : 'min-h-[200px] p-4',
          )}
        >
          <p className="text-sm leading-relaxed">{answer.text}</p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('aiCitations')}
          </p>
          <ul className="mt-2 space-y-2">
            {answer.ids.map((id) => {
              const e = entities.find((row) => row.id === id);
              return (
                <li key={id}>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 font-mono text-xs"
                    onClick={() => {
                      selectEntity(id);
                      focusView(null);
                    }}
                  >
                    {e?.name ?? id}
                  </Button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      : null}
    </div>
  );
}
