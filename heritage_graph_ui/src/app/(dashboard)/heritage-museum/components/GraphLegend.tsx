'use client';

import { useState } from 'react';
import { NODE_TYPE_CONFIG, HG_CATEGORY_CONFIG, type NodeType, type HgCategory } from '../heritage-data';

interface GraphLegendProps {
  /**
   * Map of NodeType -> count in the currently visible graph. Counts are shown
   * as a small badge next to each entry. When omitted, only the type list is
   * rendered.
   */
  typeCounts?: Record<string, number>;
  /** Toggle visibility of a node type when the user clicks an entry. */
  onTypeClick?: (type: NodeType) => void;
  activeTypes?: Set<NodeType>;
}

export function GraphLegend({ typeCounts, onTypeClick, activeTypes }: GraphLegendProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-4 left-3 z-20 pointer-events-auto select-none">
      {open ? (
        <div className="w-64 max-h-[60vh] overflow-y-auto rounded-xl bg-gray-900/95 backdrop-blur-md border border-white/10 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 sticky top-0 bg-gray-900/95">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-300">Legend</h2>
            <button
              onClick={() => setOpen(false)}
              type="button"
              aria-label="Hide legend"
              className="text-gray-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          {/* Domain categories */}
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Domains</p>
            <div className="space-y-1">
              {(Object.entries(HG_CATEGORY_CONFIG) as [HgCategory, (typeof HG_CATEGORY_CONFIG)[HgCategory]][]).map(
                ([key, cfg]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: cfg.color, border: `1px solid ${cfg.border}` }}
                      aria-hidden="true"
                    />
                    <span className="text-gray-300">{cfg.label}</span>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Node types */}
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Classes</p>
            <div className="space-y-1">
              {(Object.entries(NODE_TYPE_CONFIG) as [NodeType, (typeof NODE_TYPE_CONFIG)[NodeType]][]).map(
                ([key, cfg]) => {
                  const count = typeCounts?.[key] ?? 0;
                  const isActive = activeTypes?.has(key) ?? true;
                  const dimmed = !isActive || count === 0;
                  const node = (
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[12px] flex-shrink-0"
                      style={{
                        background: `radial-gradient(circle at 35% 35%, ${cfg.glowColor}, ${cfg.color})`,
                        fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif",
                        opacity: dimmed ? 0.35 : 1,
                      }}
                      aria-hidden="true"
                    >
                      {cfg.emoji}
                    </span>
                  );
                  const content = (
                    <>
                      {node}
                      <span className={dimmed ? 'text-gray-500' : 'text-gray-200'}>{cfg.label}</span>
                      {typeCounts && (
                        <span className="ml-auto font-mono text-[10px] text-gray-500">{count}</span>
                      )}
                    </>
                  );
                  return onTypeClick ? (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onTypeClick(key)}
                      aria-pressed={isActive}
                      className="w-full flex items-center gap-2 text-xs hover:bg-white/5 rounded px-1 py-0.5 transition-colors"
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
        <button
          onClick={() => setOpen(true)}
          type="button"
          aria-label="Show legend"
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-900/80 backdrop-blur-md text-gray-300 border border-white/10 hover:bg-gray-900 transition-all flex items-center gap-1.5"
        >
          <span aria-hidden="true">📖</span>
          <span>Legend</span>
        </button>
      )}
    </div>
  );
}
