'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { IconBook } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { NODE_TYPE_CONFIG, HG_CATEGORY_CONFIG, type NodeType, type HgCategory } from '../heritage-data';
import { NodeGlyph } from '../node-icons';

interface GraphLegendProps {
  typeCounts?: Record<string, number>;
  onTypeClick?: (type: NodeType) => void;
  activeTypes?: Set<NodeType>;
}

export function GraphLegend({ typeCounts, onTypeClick, activeTypes }: GraphLegendProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('heritageMuseum.legend');

  return (
    <div className="absolute bottom-4 left-3 z-20 pointer-events-auto select-none">
      {open ? (
        <div className="w-64 max-h-[60vh] overflow-y-auto rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-card/95">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">{t('title')}</h2>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t('hide')}
            >
              ×
            </Button>
          </div>

          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{t('domains')}</p>
            <div className="space-y-1">
              {(Object.entries(HG_CATEGORY_CONFIG) as [HgCategory, (typeof HG_CATEGORY_CONFIG)[HgCategory]][]).map(
                ([key, cfg]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: cfg.color, border: `1px solid ${cfg.border}` }}
                      aria-hidden="true"
                    />
                    <span className="text-foreground">{cfg.label}</span>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{t('classes')}</p>
            <div className="space-y-1">
              {(Object.entries(NODE_TYPE_CONFIG) as [NodeType, (typeof NODE_TYPE_CONFIG)[NodeType]][]).map(
                ([key, cfg]) => {
                  const count = typeCounts?.[key] ?? 0;
                  const isActive = activeTypes?.has(key) ?? true;
                  const dimmed = !isActive || count === 0;
                  const node = (
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `radial-gradient(circle at 35% 35%, ${cfg.glowColor}, ${cfg.color})`,
                        opacity: dimmed ? 0.35 : 1,
                      }}
                      aria-hidden="true"
                    >
                      <NodeGlyph nodeType={key} size={13} color="#fff" />
                    </span>
                  );
                  const content = (
                    <>
                      {node}
                      <span className={cn(dimmed ? 'text-muted-foreground' : 'text-foreground')}>{cfg.label}</span>
                      {typeCounts && (
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{count}</span>
                      )}
                    </>
                  );
                  return onTypeClick ? (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onTypeClick(key)}
                      aria-pressed={isActive}
                      className="w-full flex items-center gap-2 text-xs hover:bg-muted/60 rounded px-1 py-0.5 transition-colors"
                      title={cfg.cidocMapping}
                    >
                      {content}
                    </button>
                  ) : (
                    <div key={key} className="flex items-center gap-2 text-xs px-1 py-0.5" title={cfg.cidocMapping}>
                      {content}
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-full text-xs gap-1.5 shadow-sm"
          aria-label={t('show')}
        >
          <IconBook className="w-3.5 h-3.5" aria-hidden />
          {t('title')}
        </Button>
      )}
    </div>
  );
}
