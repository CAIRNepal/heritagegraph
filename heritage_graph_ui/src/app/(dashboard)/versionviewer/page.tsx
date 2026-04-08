'use client';

import dynamic from 'next/dynamic';

const VersionViewerClient = dynamic(
  () => import('./version-viewer-client').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-[50vh] items-center justify-center text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        Loading version viewer…
      </div>
    ),
  },
);

export default function VersionViewerPage() {
  return <VersionViewerClient />;
}
