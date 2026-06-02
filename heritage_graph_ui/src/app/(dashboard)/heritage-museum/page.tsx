import { HeritageMindMapClient } from './heritage-museum-client';

export default function HeritageMuseumPage() {
  return (
    <div
      className="relative -mx-4 -my-4 flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:-mx-6"
      style={{
        /* Fit below dashboard header + main padding + footer so inner panes scroll, not the page */
        height: 'calc(100svh - 7.25rem)',
        maxHeight: 'calc(100svh - 7.25rem)',
      }}
    >
      <HeritageMindMapClient />
    </div>
  );
}
