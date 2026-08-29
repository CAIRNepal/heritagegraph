import { EntryDirectionA } from '@/components/unesco/EntryDirectionA';

export const metadata = {
  title: 'Entry — Direction A · HeritageGraph',
  robots: { index: false, follow: false },
};

/**
 * Review-only route for Phase 2. The chosen direction is promoted to `/` and
 * these two preview routes are removed.
 *
 * `-mx-4 -my-4 md:-mx-6` cancels the dashboard main's padding so full-bleed
 * photography actually reaches the edge — same technique the museum uses.
 */
export default function EntryPreviewA() {
  return (
    <div className="-mx-4 -my-4 md:-mx-6">
      <EntryDirectionA />
    </div>
  );
}
