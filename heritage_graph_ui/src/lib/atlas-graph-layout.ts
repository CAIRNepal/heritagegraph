import type { LayoutOptions } from 'cytoscape';

import { atlasPrefersReducedMotion } from '@/lib/atlas-motion';

export function atlasGraphLayoutOptions(nodeCount: number): LayoutOptions {
  const reduced = atlasPrefersReducedMotion();
  const useBilkent = nodeCount > 60;

  if (useBilkent) {
    return {
      name: 'cose-bilkent',
      animate: !reduced,
      animationDuration: reduced ? 0 : 700,
      fit: true,
      padding: 18,
      randomize: false,
      nodeRepulsion: 6500,
      idealEdgeLength: 95,
      gravity: 0.32,
      gravityRangeCompound: 1.4,
      tilingPaddingVertical: 12,
      tilingPaddingHorizontal: 12,
    } as LayoutOptions;
  }

  return {
    name: 'cose',
    animate: !reduced,
    animationDuration: reduced ? 0 : 650,
    fit: true,
    padding: 16,
    randomize: false,
    nodeRepulsion: () => 6200,
    idealEdgeLength: () => 95,
    gravity: 0.28,
  } as LayoutOptions;
}
