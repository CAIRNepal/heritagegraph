import { Suspense } from 'react';

import { HeritageMindMapClient } from './heritage-museum-client';
import { MandalaLoader } from './components/MandalaLoader';

export const metadata = {
  title: 'Heritage Museum · HeritageGraph',
  description:
    'Explore a CIDOC-CRM knowledge graph of cultural heritage: reviewed live data, provenance-backed relationships, map, timeline, and immersive views.',
  openGraph: {
    title: 'Heritage Museum · HeritageGraph',
    description:
      'Interactive knowledge-graph museum with ontology-typed nodes, provenance-backed edges, and SPARQL-exportable data.',
    type: 'website',
  },
};

export default function HeritageMuseumPage() {
  // Definite viewport-based height (not flex-1/min-h): the dashboard's
  // main/SidebarInset chain is min-h-svh (growable), so it never bounds this
  // page to the viewport. Without a concrete height the museum's inner CSS grid
  // (graph row + timeline row) can't constrain row 1, so selecting a node lets
  // the StoryPanel grow and pushes the timeline below the fold. A fixed
  // `100svh - header(3.5rem)` makes h-full/grid resolve and keeps the timeline
  // pinned and on-screen. `-my-4` cancels main's py-4 so the math stays exact.
  return (
    <div className="relative -mx-4 -my-4 flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-background md:-mx-6">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <MandalaLoader />
          </div>
        }
      >
        <HeritageMindMapClient />
      </Suspense>
    </div>
  );
}
