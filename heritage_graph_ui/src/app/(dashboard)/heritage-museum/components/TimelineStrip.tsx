'use client';

import { NODE_TYPE_CONFIG, type GraphNode } from '../heritage-data';

interface TimelineStripProps {
  nodes: GraphNode[];
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
}

const TIMELINE_PERIODS = [
  { id: 'licchavi', year: 400,  label: 'Licchavi Era' },
  { id: 'malla',    year: 1200, label: 'Malla Era' },
  { id: 'shah',     year: 1768, label: 'Shah Era' },
];

export function TimelineStrip({ nodes, selectedId, onSelect }: TimelineStripProps) {
  const datedNodes = nodes
    .filter((n) => n.inceptionYear)
    .sort((a, b) => parseInt(a.inceptionYear!) - parseInt(b.inceptionYear!));

  if (datedNodes.length === 0) return null;

  return (
    <div className="relative flex-shrink-0 px-6 py-4 border-t border-white/10 bg-gray-950/80 backdrop-blur-md">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
        Historical Timeline
      </div>

      <div className="relative">
        {/* Timeline axis */}
        <div className="absolute left-0 right-0 top-[calc(50%+1.25rem)] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Period labels */}
        <div className="absolute top-0 left-0 right-0 flex justify-between px-2">
          {TIMELINE_PERIODS.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-0.5">
              <span className="text-xs text-indigo-400 font-medium">{p.label}</span>
              <span className="text-xs text-gray-600">{p.year} CE</span>
            </div>
          ))}
        </div>

        {/* Scrollable node row */}
        <div
          className="flex gap-3 overflow-x-auto pb-2 pt-10"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
        >
          {datedNodes.map((node) => {
            const cfg = NODE_TYPE_CONFIG[node.nodeType];
            const isSelected = node.id === selectedId;
            return (
              <button
                key={node.id}
                onClick={() => onSelect(node)}
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
                <span className="text-xs text-gray-400 group-hover:text-white transition-colors max-w-16 text-center leading-tight">
                  {node.label.length > 12 ? node.label.slice(0, 10) + '…' : node.label}
                </span>
                <span className="text-xs text-gray-600">{node.inceptionYear}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
