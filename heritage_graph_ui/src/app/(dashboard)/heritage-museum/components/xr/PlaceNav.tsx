'use client';

import { NODE_TYPE_CONFIG, type GraphNode, type NodeType } from '../../heritage-data';

interface PlaceNavProps {
  nodes: GraphNode[];
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
}

function NavNode({ node, selected, onSelect }: { node: GraphNode; selected: boolean; onSelect: () => void }) {
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group hover:bg-white/5"
      style={selected
        ? { background: `${cfg.color}22`, borderLeft: `3px solid ${cfg.color}`, paddingLeft: '9px' }
        : { borderLeft: '3px solid transparent' }
      }
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden"
        style={node.imageUrl ? undefined : { background: `linear-gradient(135deg, ${cfg.color}44, #0f172a)` }}
      >
        {node.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">{cfg.emoji}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate leading-tight" style={{ color: selected ? cfg.glowColor : '#e5e7eb' }}>
          {node.label}
        </p>
        <p className="text-xs mt-0.5" style={{ color: `${cfg.color}bb` }}>{cfg.label}</p>
      </div>
      <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: cfg.glowColor }}>→</span>
    </button>
  );
}

export function PlaceNav({ nodes, selectedId, onSelect }: PlaceNavProps) {
  const typeGroups = nodes.reduce<Record<string, GraphNode[]>>((acc, n) => {
    if (!acc[n.nodeType]) acc[n.nodeType] = [];
    acc[n.nodeType].push(n);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-gray-950/90 border-r border-white/10 backdrop-blur-md">
      <div className="flex-shrink-0 px-4 py-4 border-b border-white/10">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Heritage Sites</p>
        <p className="text-xs text-gray-600 mt-0.5">{nodes.length} places</p>
      </div>
      <div
        className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        {Object.entries(typeGroups).map(([type, group]) => {
          const cfg = NODE_TYPE_CONFIG[type as NodeType];
          return (
            <div key={type}>
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs text-gray-600 uppercase tracking-wider">
                  {cfg?.emoji} {cfg?.label}
                </span>
              </div>
              {group.map((node) => (
                <NavNode
                  key={node.id}
                  node={node}
                  selected={node.id === selectedId}
                  onSelect={() => onSelect(node)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
