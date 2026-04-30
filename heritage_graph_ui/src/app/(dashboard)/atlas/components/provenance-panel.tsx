'use client';

import { IconChevronRight } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { assertionGroups, rootAssertionChain, tierFromAssertionSources } from '@/lib/atlas-provenance-helpers';
import type { DataSource, HeritageAssertion, ReliabilityTier } from '@/types/atlas';

import { ProvenanceBadge } from './provenance-badge';

function AssertionTierStrip({ tier }: { tier: ReliabilityTier | null }) {
  const tiers: ReliabilityTier[] = ['A', 'B', 'C', 'D'];
  return (
    <div className="flex h-1.5 max-w-[12rem] gap-px overflow-hidden rounded-full bg-muted/40">
      {tiers.map((x) => (
        <div
          key={x}
          className={cn(
            'min-w-0 flex-1 rounded-[1px]',
            tier === x ? 'bg-primary' : 'bg-muted-foreground/20',
          )}
        />
      ))}
    </div>
  );
}

interface ProvenancePanelProps {
  assertions: HeritageAssertion[];
  sources: DataSource[];
}

export function ProvenancePanel({ assertions, sources }: ProvenancePanelProps) {
  const t = useTranslations('Atlas');

  const groups = assertionGroups(assertions);

  return (
    <ScrollArea className="max-h-[min(48vh,28rem)] pr-2">
      <div className="space-y-3 pb-2">
        {assertions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noAssertions')}</p>
        ) : (
          [...groups.entries()].map(([prop, rows]) => {
            const sorted = [...rows].sort((a, b) =>
              b.generatedAtTime.localeCompare(a.generatedAtTime),
            );

            return (
              <div key={prop} className="rounded-lg border border-border/60 bg-muted/25">
                <div className="border-b border-border/40 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {prop}
                </div>
                <ul className="divide-y divide-border/40">
                  {sorted.map((a) => {
                    const chain = rootAssertionChain(a, assertions);
                    const tier = tierFromAssertionSources(a, sources);

                    return (
                      <li key={a.id} className="space-y-1 px-2 py-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <ProvenanceBadge assertion={a} tier={tier} />
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {a.generatedAtTime.replace('T', ' ').slice(0, 16)}
                          </span>
                        </div>
                        <p className="text-[13px] leading-snug">{a.assertedValue}</p>
                        <AssertionTierStrip tier={tier} />
                        {chain.length > 1 ? (
                          <div className="flex flex-wrap gap-1 pt-1 text-[10px] text-muted-foreground">
                            <span>{t('supersedesChain')}</span>
                            {chain.map((c, idx) => (
                              <span key={c.id} className="inline-flex items-center gap-0.5 font-mono">
                                {idx > 0 ? (
                                  <IconChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                                ) : null}
                                {c.id.slice(-8)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
