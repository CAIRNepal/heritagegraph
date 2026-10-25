'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

import type { GraphData, GraphNode } from '../../heritage-data';
import { MandalaLoader } from '../MandalaLoader';
import { TimelineStrip } from '../TimelineStrip';
import type { LensKind } from './ContextColumn';
import { EgoGraph } from './EgoGraph';
import { coordsOf } from './exhibit-utils';

const MapView = dynamic(() => import('../MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <MandalaLoader />
    </div>
  ),
});

interface MuseumLensProps {
  kind: LensKind | null;
  onClose: () => void;
  node: GraphNode;
  graph: GraphData;
  /** What the map and timeline show: the collection after search and filters. */
  visibleNodes: GraphNode[];
  onSelect: (node: GraphNode) => void;
}

/**
 * Full-size views opened from the context column. Map and timeline close when
 * a record is picked, so the reader lands on it; the graph stays open and
 * re-centres, because moving through it is the point.
 */
export function MuseumLens({ kind, onClose, node, graph, visibleNodes, onSelect }: MuseumLensProps) {
  const tx = useTranslations('heritageMuseum.exhibit');
  const located = visibleNodes.filter((n) => coordsOf(n)).length;
  const title =
    kind === 'map'
      ? tx('mapLensTitle', { count: located })
      : kind === 'timeline'
        ? tx('timelineLensTitle')
        : tx('graphLensTitle', { name: node.label });
  const pickAndClose = (n: GraphNode) => {
    onSelect(n);
    onClose();
  };

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="grid h-[min(88vh,860px)] w-[min(1100px,96vw)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-none">
        <div className="border-b border-border px-5 py-3.5 pr-12">
          <DialogTitle className="font-serif text-xl font-medium">{title}</DialogTitle>
          {kind === 'graph' ? (
            <DialogDescription className="pt-1 text-xs">{tx('graphLensHint')}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </div>
        <div className="relative min-h-0 overflow-auto">
          {kind === 'map' ? (
            <div className="absolute inset-0">
              <MapView nodes={visibleNodes} selectedId={node.id} onNodeSelect={pickAndClose} />
            </div>
          ) : kind === 'timeline' ? (
            <div className="flex h-full flex-col">
              <TimelineStrip nodes={visibleNodes} selectedId={node.id} onSelect={pickAndClose} />
            </div>
          ) : kind === 'graph' ? (
            <div className="p-4">
              <EgoGraph node={node} graph={graph} onSelect={onSelect} />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
