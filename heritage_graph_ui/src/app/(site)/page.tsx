import { UnescoEntry } from '@/components/unesco/UnescoEntry';

export const metadata = {
  title: 'HeritageGraph — Nepal on the UNESCO World Heritage List',
  description:
    "Nepal's two cultural World Heritage properties: the Kathmandu Valley, inscribed in 1979 as a serial property of seven monument zones, and Lumbini, inscribed in 1997. Every fact traceable, every photograph credited.",
  openGraph: {
    title: 'HeritageGraph — Nepal on the UNESCO World Heritage List',
    description:
      'The Kathmandu Valley as a single serial property of seven monument zones, and Lumbini as the second cultural property. A provenance-backed record from CAIR-Nepal.',
    type: 'website',
  },
};

/**
 * The public entry experience.
 *
 * `-mx-4 -my-4 md:-mx-6` cancels the dashboard main's padding so full-bleed
 * photography reaches the edge — the same technique the museum route uses.
 *
 * The dashboard that previously lived here now sits at /dashboard, unchanged.
 */
export default function HomePage() {
  return (
    <div className="-mx-4 -my-4 md:-mx-6">
      <UnescoEntry />
    </div>
  );
}
