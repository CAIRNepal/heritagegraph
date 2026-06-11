'use client';

import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { colorForOntologyClass } from '@/lib/atlas-globe-colors';
import { atlasGraphLayoutOptions } from '@/lib/atlas-graph-layout';
import { atlasPrefersReducedMotion } from '@/lib/atlas-motion';
import { cn } from '@/lib/utils';
import type { OntologyClass } from '@/types/atlas';

import { AtlasGraphLegend } from '../components/atlas-graph-legend';
import { EntityHoverCard } from '../components/entity-hover-card';
import { useAtlasStore, useAtlasViewEdges, useFilteredAtlasEntities } from '../hooks/use-atlas-store';

let coseBilkentRegistered = false;
if (!coseBilkentRegistered) {
  cytoscape.use(coseBilkent);
  coseBilkentRegistered = true;
}

const GRAPH_NODE_SOFT_CAP = 120;

interface GraphViewProps {
  compact?: boolean;
  className?: string;
}

export function GraphView({ compact = false, className }: GraphViewProps) {
  const t = useTranslations('Atlas');
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const filteredEntities = useFilteredAtlasEntities();
  const viewEdges = useAtlasViewEdges();
  const selectedId = useAtlasStore((s) => s.selectedId);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const setHover = useAtlasStore((s) => s.setHover);

  const displayEntities = useMemo(() => {
    if (filteredEntities.length <= GRAPH_NODE_SOFT_CAP) return filteredEntities;
    // Over the cap: keep the selected entity, its direct neighbourhood, then
    // the best-connected nodes, so truncation preserves the useful subgraph.
    const degree = new Map<string, number>();
    const neighborsOfSelected = new Set<string>();
    for (const ed of viewEdges) {
      degree.set(ed.source, (degree.get(ed.source) ?? 0) + 1);
      degree.set(ed.target, (degree.get(ed.target) ?? 0) + 1);
      if (selectedId) {
        if (ed.source === selectedId) neighborsOfSelected.add(ed.target);
        if (ed.target === selectedId) neighborsOfSelected.add(ed.source);
      }
    }
    const rank = (e: (typeof filteredEntities)[0]): number => {
      if (e.id === selectedId) return 3;
      if (neighborsOfSelected.has(e.id)) return 2;
      return 0;
    };
    return [...filteredEntities]
      .sort((a, b) => rank(b) - rank(a) || (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
      .slice(0, GRAPH_NODE_SOFT_CAP);
  }, [filteredEntities, viewEdges, selectedId]);

  const classCounts = useMemo(() => {
    const counts: Partial<Record<OntologyClass, number>> = {};
    for (const e of displayEntities) {
      counts[e.class] = (counts[e.class] ?? 0) + 1;
    }
    return counts;
  }, [displayEntities]);

  const truncated = filteredEntities.length > displayEntities.length;
  const layoutOpts = useMemo(
    () => atlasGraphLayoutOptions(displayEntities.length),
    [displayEntities.length],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const nodeIds = new Set(displayEntities.map((e) => e.id));
    const elements: cytoscape.ElementDefinition[] = [];

    for (const e of displayEntities) {
      const hasConflict = e.assertions.some((a) => a.reconciliationStatus === 'conflicting');
      elements.push({
        data: {
          id: e.id,
          label: e.name.length > 28 ? `${e.name.slice(0, 26)}…` : e.name,
          ontologyClass: e.class,
          fill: colorForOntologyClass(e.class),
          hasConflict,
        },
      });
    }

    for (const ed of viewEdges) {
      if (!nodeIds.has(ed.source) || !nodeIds.has(ed.target)) continue;
      elements.push({
        data: {
          id: ed.id,
          source: ed.source,
          target: ed.target,
          label: ed.predicate.replace(/_/g, ' '),
          hasProvenance: ed.hasProvenance === true,
        },
      });
    }

    const existing = cyRef.current;
    if (existing && !existing.destroyed()) {
      existing.batch(() => {
        existing.elements().remove();
        existing.add(elements);
      });
      existing.layout(layoutOpts).run();
      return;
    }

    const cy = cytoscape({
      container: el,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': 'data(fill)',
            color: '#f3f6fa',
            'font-size': '9px',
            'text-valign': 'center',
            'text-halign': 'center',
            width: 48,
            height: 48,
            'border-width': 2,
            'border-color': '#1f2936',
            'text-wrap': 'ellipsis',
            'text-max-width': '44px',
          },
        },
        {
          selector: 'node[?hasConflict]',
          style: {
            'border-width': 3,
            'border-color': '#e5544b',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#5a9bff',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.25,
            'line-color': '#526379',
            'target-arrow-color': '#526379',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            opacity: 0.85,
            label: 'data(label)',
            color: '#a0b3c8',
            'font-size': '7px',
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
            'text-background-opacity': 0.88,
            'text-background-color': '#111821',
            'text-background-shape': 'roundrectangle',
          },
        },
        {
          // Assertion-backed edges (with PROV-O provenance) read stronger than
          // structural FK edges.
          selector: 'edge[?hasProvenance]',
          style: {
            width: 2,
            'line-color': '#7fb069',
            'target-arrow-color': '#7fb069',
            opacity: 1,
          },
        },
      ],
      wheelSensitivity: 0.35,
      minZoom: 0.15,
      maxZoom: 2.5,
    });

    cyRef.current = cy;
    cy.layout(layoutOpts).run();

    cy.on('tap', 'node', (evt) => {
      selectEntity(evt.target.id());
    });

    cy.on('mouseover', 'node', (evt) => {
      const oe = evt.originalEvent as MouseEvent | undefined;
      setHover(evt.target.id(), oe ? { x: oe.clientX, y: oe.clientY } : null);
    });

    cy.on('mouseout', 'node', () => {
      setHover(null, null);
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [displayEntities, viewEdges, layoutOpts, selectEntity, setHover]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.destroyed() || !selectedId) return;
    const node = cy.getElementById(selectedId);
    if (node.nonempty()) {
      const duration = atlasPrefersReducedMotion() ? 0 : 280;
      cy.animate(
        { center: { eles: node }, zoom: Math.min(cy.zoom() * 1.15, 1.4) },
        { duration },
      );
    }
  }, [selectedId]);

  return (
    <div
      className={cn(
        'relative flex h-full flex-col',
        compact ? 'min-h-[140px]' : 'min-h-[420px]',
        className,
      )}
    >
      {!compact ? <EntityHoverCard /> : null}
      {truncated ?
        <p
          className="pointer-events-none absolute inset-x-2 top-2 z-10 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-center font-mono text-[10px] text-amber-950 dark:text-amber-100"
          role="status"
        >
          {t('graphTruncated', {
            shown: displayEntities.length,
            total: filteredEntities.length,
          })}
        </p>
      : null}
      <div ref={containerRef} className="min-h-0 flex-1 rounded-lg border border-border/60 bg-card/40" />
      <AtlasGraphLegend classCounts={classCounts} />
    </div>
  );
}