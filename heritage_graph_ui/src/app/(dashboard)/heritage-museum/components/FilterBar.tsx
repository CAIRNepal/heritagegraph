'use client';

import { NODE_TYPE_CONFIG, type NodeType } from '../heritage-data';

interface FilterBarProps {
  activeTypes: Set<NodeType>;
  onToggle: (type: NodeType) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function FilterBar({ activeTypes, onToggle, searchQuery, onSearchChange }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 border-b border-white/10 bg-gray-950/80 backdrop-blur-md">
      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search heritage nodes…"
          className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(NODE_TYPE_CONFIG) as [NodeType, (typeof NODE_TYPE_CONFIG)[NodeType]][]).map(
          ([type, cfg]) => {
            const isActive = activeTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => onToggle(type)}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all hover:scale-105 active:scale-95"
                style={{
                  borderColor: isActive ? cfg.color : `${cfg.color}44`,
                  background:  isActive ? `${cfg.color}33` : `${cfg.color}0a`,
                  color:       isActive ? cfg.glowColor : `${cfg.glowColor}88`,
                }}
              >
                <span>{cfg.emoji}</span>
                <span>{cfg.label}</span>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}
