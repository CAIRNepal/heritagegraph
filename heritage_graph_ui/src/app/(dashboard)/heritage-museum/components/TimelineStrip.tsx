'use client';

import { useTranslations } from 'next-intl';

import { glassCard } from '@/lib/design';
import { cn } from '@/lib/utils';

import { NODE_TYPE_CONFIG, type GraphNode } from '../heritage-data';

interface TimelineStripProps {
  nodes: GraphNode[];
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
}

const TIMELINE_PERIOD_KEYS = [
  { id: 'licchavi', year: 400, labelKey: 'licchavi' as const },
  { id: 'malla', year: 1200, labelKey: 'malla' as const },
  { id: 'shah', year: 1768, labelKey: 'shah' as const },
];

export function TimelineStrip({ nodes, selectedId, onSelect }: TimelineStripProps) {
  const t = useTranslations('heritageMuseum.timeline');

  const datedNodes = nodes
    .filter((n) => n.inceptionYear)
    .sort((a, b) => parseInt(a.inceptionYear!) - parseInt(b.inceptionYear!));

  if (datedNodes.length === 0) return null;

  return (
    <div className={cn(glassCard, 'relative flex-shrink-0 px-6 py-4 border-t border-border rounded-none shadow-none')}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
        {t('title')}
      </div>

      <div className="relative">
        <div className="absolute left-0 right-0 top-[calc(50%+1.25rem)] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="absolute top-0 left-0 right-0 flex justify-between px-2">
          {TIMELINE_PERIOD_KEYS.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-0.5">
              <span className="text-xs text-primary font-medium">{t(p.labelKey)}</span>
              <span className="text-xs text-muted-foreground">{t('ce', { year: p.year })}</span>
            </div>
          ))}
        </div>

        <div
          className="flex gap-3 overflow-x-auto pb-2 pt-10"
          style={{ scrollbarWidth: 'thin' }}
        >
          {datedNodes.map((node) => {
            const cfg = NODE_TYPE_CONFIG[node.nodeType];
            const isSelected = node.id === selectedId;
            return (
              <button
                key={node.id}
                onClick={() => onSelect(node)}
                type="button"
                className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-base transition-all group-hover:scale-110"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${cfg.glowColor}, ${cfg.color})`,
                    boxShadow: isSelected ? `0 0 16px ${cfg.color}` : 'none',
                    border: isSelected ? `2px solid ${cfg.glowColor}` : '2px solid transparent',
                  }}
                >
                  {cfg.emoji}
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors max-w-16 text-center leading-tight">
                  {node.label.length > 12 ? node.label.slice(0, 10) + '…' : node.label}
                </span>
                <span className="text-xs text-muted-foreground/80">{node.inceptionYear}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
