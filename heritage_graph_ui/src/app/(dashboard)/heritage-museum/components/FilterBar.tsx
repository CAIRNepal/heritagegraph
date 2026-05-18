'use client';

import { NODE_TYPE_CONFIG, HG_CATEGORY_CONFIG, type NodeType, type HgCategory } from '../heritage-data';

interface FilterBarProps {
  activeTypes: Set<NodeType>;
  onToggle: (type: NodeType) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeCategoryFilter: Set<HgCategory>;
  onCategoryToggle: (cat: HgCategory) => void;
  onShowAllCategories?: () => void;
  onShowAllTypes?: () => void;
  totalNodes?: number;
  visibleNodes?: number;
}

export function FilterBar({
  activeTypes,
  onToggle,
  searchQuery,
  onSearchChange,
  activeCategoryFilter,
  onCategoryToggle,
  onShowAllCategories,
  onShowAllTypes,
  totalNodes,
  visibleNodes,
}: FilterBarProps) {
  const allCatsActive = activeCategoryFilter.size === Object.keys(HG_CATEGORY_CONFIG).length;
  const allTypesActive = activeTypes.size === Object.keys(NODE_TYPE_CONFIG).length;

  return (
    <div
      className="flex flex-col gap-2.5 px-4 py-3 border-b border-white/10 bg-gray-950/80 backdrop-blur-md"
      role="region"
      aria-label="Heritage graph filters"
    >
      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true">🔍</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search heritage nodes by name, description, or tag…"
          className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-20 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
          aria-label="Search heritage nodes"
        />
        {/* Result counter */}
        {typeof totalNodes === 'number' && typeof visibleNodes === 'number' && (
          <span className="absolute right-9 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-mono pointer-events-none">
            {visibleNodes}/{totalNodes}
          </span>
        )}
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
            aria-label="Clear search"
            type="button"
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
                aria-pressed={isActive}
                type="button"
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border font-medium transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
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
        {!allCatsActive && (
          <button
            onClick={onShowAllCategories}
            type="button"
            className="text-[10px] text-gray-400 hover:text-gray-100 px-1.5 py-0.5 transition-colors underline-offset-2 hover:underline"
          >
            show all
          </button>
        )}
      </div>

      {/* Class filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest mr-1 shrink-0">Class</span>
        {(Object.entries(NODE_TYPE_CONFIG) as [NodeType, (typeof NODE_TYPE_CONFIG)[NodeType]][]).map(
          ([type, cfg]) => {
            const isActive = activeTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => onToggle(type)}
                aria-pressed={isActive}
                type="button"
                title={cfg.cidocMapping}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                style={{
                  borderColor: isActive ? cfg.color : `${cfg.color}44`,
                  background:  isActive ? `${cfg.color}33` : `${cfg.color}0a`,
                  color:       isActive ? cfg.glowColor : `${cfg.glowColor}88`,
                }}
              >
                <span aria-hidden="true">{cfg.emoji}</span>
                <span>{cfg.label}</span>
              </button>
            );
          }
        )}
        {!allTypesActive && (
          <button
            onClick={onShowAllTypes}
            type="button"
            className="text-[10px] text-gray-400 hover:text-gray-100 px-1.5 py-0.5 transition-colors underline-offset-2 hover:underline"
          >
            show all
          </button>
        )}
      </div>
    </div>
  );
}
