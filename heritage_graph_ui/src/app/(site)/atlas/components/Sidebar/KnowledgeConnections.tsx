'use client';

import { motion } from 'framer-motion';
import { Waypoints } from 'lucide-react';
import { useMemo } from 'react';

import type { AtlasEntity, OntologyEdge } from '@/types/atlas';

import { useAtlasStore } from '../../hooks/use-atlas-store';
import { markerStyleForEntity } from '../HeritageGlobe/marker-config';

const MAX_CONNECTIONS = 18;

function predicateLabel(predicate: string): string {
  return predicate.replace(/_/g, ' ');
}

interface KnowledgeConnectionsProps {
  entity: AtlasEntity;
}

/**
 * The knowledge-graph neighbourhood of the selected entity. Every row is a
 * semantic jump: clicking a related person/festival/monument re-centres the
 * exploration on it — the journey continues node by node.
 */
export function KnowledgeConnections({ entity }: KnowledgeConnectionsProps) {
  const edges = useAtlasStore((s) => s.edges);
  const getEntityById = useAtlasStore((s) => s.getEntityById);
  const selectEntity = useAtlasStore((s) => s.selectEntity);

  const connections = useMemo(() => {
    const touching = edges.filter(
      (ed) => ed.source === entity.id || ed.target === entity.id,
    );
    const rows: { edge: OntologyEdge; other: AtlasEntity; outgoing: boolean }[] = [];
    const seen = new Set<string>();
    for (const edge of touching) {
      const outgoing = edge.source === entity.id;
      const otherId = outgoing ? edge.target : edge.source;
      const key = `${edge.predicate}:${otherId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const other = getEntityById(otherId);
      if (other) rows.push({ edge, other, outgoing });
    }
    return rows;
  }, [edges, entity.id, getEntityById]);

  if (connections.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/50 px-3 py-2.5 text-[12px] text-muted-foreground">
        No graph connections recorded for this entity yet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {connections.slice(0, MAX_CONNECTIONS).map(({ edge, other, outgoing }, i) => {
        const style = markerStyleForEntity(other);
        return (
          <motion.button
            key={edge.id}
            type="button"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.25 }}
            onClick={() => selectEntity(other.id)}
            className="group flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition-colors hover:border-border/50 hover:bg-muted/40"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full transition-shadow group-hover:shadow-[0_0_8px]"
              style={{ backgroundColor: style.color, color: style.color }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-tight">
                {other.name}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {outgoing ? '' : '← '}
                {predicateLabel(edge.predicate)}
                {edge.hasProvenance ? ' · sourced' : ''}
              </span>
            </span>
            <Waypoints
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground"
              strokeWidth={1.5}
            />
          </motion.button>
        );
      })}
      {connections.length > MAX_CONNECTIONS ? (
        <p className="px-2.5 pt-1 text-[10px] text-muted-foreground/60">
          +{connections.length - MAX_CONNECTIONS} more connections in the knowledge graph
        </p>
      ) : null}
    </div>
  );
}
