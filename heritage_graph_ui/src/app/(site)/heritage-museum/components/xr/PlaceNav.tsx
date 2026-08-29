'use client';

import { useMemo, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';

import { Input } from '@/components/ui/input';
import { useXrTranslations, xrNavItemBase } from '@/lib/heritage-museum/xr-theme';
import { cn } from '@/lib/utils';

import { NODE_TYPE_CONFIG, type GraphNode, type NodeType } from '../../heritage-data';
import { NodeGlyph } from '../../node-icons';

interface PlaceNavProps {
  nodes: GraphNode[];
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
}

function hasVisual(node: GraphNode): boolean {
  return Boolean(node.imageUrl || node.images?.length);
}

function NavNode({
  node,
  selected,
  onSelect,
}: {
  node: GraphNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        xrNavItemBase,
        'group',
        selected && 'bg-primary/10 ring-1 ring-primary/30',
      )}
      style={selected ? { borderLeft: `3px solid ${cfg.color}`, paddingLeft: '9px' } : { borderLeft: '3px solid transparent' }}
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60"
        style={
          node.imageUrl
            ? undefined
            : { background: `linear-gradient(135deg, ${cfg.color}33, var(--muted))` }
        }
      >
        {node.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <NodeGlyph nodeType={node.nodeType} size={20} color={cfg.color} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-xs font-semibold leading-tight"
          style={{ color: selected ? cfg.color : undefined }}
        >
          {node.label}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{cfg.label}</p>
      </div>
      <span
        className="flex-shrink-0 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      >
        →
      </span>
    </button>
  );
}

export function PlaceNav({ nodes, selectedId, onSelect }: PlaceNavProps) {
  const t = useXrTranslations();
  const [query, setQuery] = useState('');

  const sorted = useMemo(
    () =>
      [...nodes].sort((a, b) => {
        const av = hasVisual(a) ? 0 : 1;
        const bv = hasVisual(b) ? 0 : 1;
        if (av !== bv) return av - bv;
        return a.label.localeCompare(b.label);
      }),
    [nodes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.tags?.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [sorted, query]);

  const typeGroups = useMemo(
    () =>
      filtered.reduce<Record<string, GraphNode[]>>((acc, n) => {
        if (!acc[n.nodeType]) acc[n.nodeType] = [];
        acc[n.nodeType].push(n);
        return acc;
      }, {}),
    [filtered],
  );

  return (
    <div className="flex h-full flex-col border-r border-border bg-card/95 backdrop-blur-md">
      <div className="flex-shrink-0 border-b border-border px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {t('navTitle')}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('navCount', { count: nodes.length })}
        </p>
        {nodes.length > 6 ? (
          <div className="relative mt-3">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchAria')}
              className="h-8 pl-8 text-xs"
            />
          </div>
        ) : null}
      </div>
      <div
        className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t('searchNoMatch')}
          </p>
        ) : null}
        {Object.entries(typeGroups).map(([type, group]) => {
          const cfg = NODE_TYPE_CONFIG[type as NodeType];
          return (
            <div key={type}>
              <div className="px-3 pb-1 pt-3">
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <NodeGlyph nodeType={type} size={13} color="currentColor" />
                  {cfg?.label}
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
