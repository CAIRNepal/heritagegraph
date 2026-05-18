'use client';

import { NODE_TYPE_CONFIG, HG_CATEGORY_CONFIG, type NodeType, type HgCategory } from '../heritage-data';

interface FilterBarProps {
  activeTypes: Set<NodeType>;
  onToggle: (type: NodeType) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeCategoryFilter: Set<HgCategory>;
  onCategoryToggle: (cat: HgCategory) => void;
}

export function FilterBar({
  activeTypes, onToggle, searchQuery, onSearchChange,
  activeCategoryFilter, onCategoryToggle,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3 border-b border-white/10 bg-gray-950/80 backdrop-blur-md">
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

      {/* Ontology domain filter (hgCategory) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest mr-1 shrink-0">Domain</span>
        {(Object.entries(HG_CATEGORY_CONFIG) as [HgCategory, (typeof HG_CATEGORY_CONFIG)[HgCategory]][]).map(
          ([cat, cfg]) => {
            const isActive = activeCategoryFilter.has(cat);
            return (
              <button
                key={cat}
                onClick={() => onCategoryToggle(cat)}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border font-medium transition-all hover:scale-105 active:scale-95"
                style={{
                  borderColor: isActive ? cfg.border : `${cfg.color}33`,
                  background:  isActive ? `${cfg.color}28` : 'transparent',
                  color:       isActive ? cfg.color : `${cfg.color}66`,
                }}
              >
                {cfg.label}
              </button>
            );
          }
        )}
        {activeCategoryFilter.size < Object.keys(HG_CATEGORY_CONFIG).length && (
          <button
            onClick={() => {
              (Object.keys(HG_CATEGORY_CONFIG) as HgCategory[]).forEach(onCategoryToggle);
            }}
            className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 transition-colors"
          >
            show all
          </button>
        )}
      </div>

      {/* Class filter chips */}
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
                <span className="font-mono">{type}</span>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}
