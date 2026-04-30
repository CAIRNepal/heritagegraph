'use client';

import cytoscape from 'cytoscape';
import { useEffect, useRef } from 'react';

import { colorForOntologyClass } from '@/lib/atlas-globe-colors';
import { cn } from '@/lib/utils';

import { EntityHoverCard } from '../components/entity-hover-card';
import { useAtlasStore, useAtlasViewEdges, useFilteredAtlasEntities } from '../hooks/use-atlas-store';

interface GraphViewProps {
  /** Embedded tile in workspace grid (smaller min-height). */
  compact?: boolean;
  className?: string;
}

export function GraphView({ compact = false, className }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredEntities = useFilteredAtlasEntities();
  const viewEdges = useAtlasViewEdges();
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const setHover = useAtlasStore((s) => s.setHover);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const entities = filteredEntities;
    const edges = viewEdges;

    const nodeIds = new Set(entities.map((e) => e.id));
    const elements: cytoscape.ElementDefinition[] = [];

    for (const e of entities) {
      const fill = colorForOntologyClass(e.class);
      elements.push({
        data: {
          id: e.id,
          label: e.name.length > 28 ? `${e.name.slice(0, 26)}…` : e.name,
          ontologyClass: e.class,
          fill,
        },
      });
    }

    for (const ed of edges) {
      if (!nodeIds.has(ed.source) || !nodeIds.has(ed.target)) continue;
      elements.push({
        data: {
          id: ed.id,
          source: ed.source,
          target: ed.target,
          label: ed.predicate,
        },
      });
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
            width: 52,
            height: 52,
            'border-width': 2,
            'border-color': '#1f2936',
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
            width: 1.5,
            'line-color': '#526379',
            'target-arrow-color': '#526379',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            label: 'data(label)',
            color: '#a0b3c8',
            'font-size': '8px',
            'text-background-opacity': 0.85,
            'text-background-color': '#111821',
            'text-background-shape': 'roundrectangle',
          },
        },
      ],
      wheelSensitivity: 0.35,
    });

    cy.layout({
      name: 'cose',
      animate: true,
      animationDuration: 900,
      fit: true,
      padding: 16,
      randomize: false,
      nodeRepulsion: () => 5200,
      idealEdgeLength: () => 90,
      gravity: 0.3,
    } as cytoscape.LayoutOptions).run();

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
    };
  }, [filteredEntities, viewEdges, selectEntity, setHover]);

  return (
    <div
      className={cn(
        'relative flex h-full flex-col',
        compact ? 'min-h-[140px]' : 'min-h-[420px]',
        className,
      )}
    >
      {!compact ? <EntityHoverCard /> : null}
      <div ref={containerRef} className="min-h-0 flex-1 rounded-lg border border-border/60 bg-card/40" />
    </div>
  );
}
