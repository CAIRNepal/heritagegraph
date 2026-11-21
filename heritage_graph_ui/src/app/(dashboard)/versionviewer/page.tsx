'use client';

import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';

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

/**
 * Design prototype — not part of the product.
 *
 * `version-viewer-client` runs entirely on fabricated review history: invented
 * contributors ("Alice"), invented moderators, and invented review comments.
 * Shipping that on a provenance platform invites a reader to mistake it for a
 * real audit trail, so the route 404s in production, matching `/test` and
 * `/infobox`. Remove the guard only once it reads real revision data.
 */
export default function VersionViewerPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <VersionViewerClient />;
}
