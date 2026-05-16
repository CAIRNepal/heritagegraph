import { HeritageMindMapClient } from './heritage-museum-client';

export default function HeritageMuseumPage() {
  return (
    /*
     * Escape the dashboard main's py-4 px-4 md:px-6 padding so the graph
     * canvas can fill the full available viewport below the sticky header.
     * 3.5rem = h-14 (56 px) — the dashboard sticky header height.
     */
    <div className="-my-4 -mx-4 md:-mx-6 h-[calc(100svh-3.5rem)] flex flex-col overflow-hidden">
      <HeritageMindMapClient />
    </div>
  );
}
