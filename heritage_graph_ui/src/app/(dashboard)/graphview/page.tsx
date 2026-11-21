'use client';

import dynamic from 'next/dynamic';

const GraphViewClient = dynamic(
  () => import('./graphview-client').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <span className="text-sm">Loading graph…</span>
      </div>
    ),
  },
);

export default function GraphViewPage() {
  return <GraphViewClient />;
}
