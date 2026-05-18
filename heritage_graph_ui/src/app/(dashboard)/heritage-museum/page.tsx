import { HeritageMindMapClient } from './heritage-museum-client';

export default function HeritageMuseumPage() {
  return (
    <div className="flex flex-col flex-1 -my-4 -mx-4 md:-mx-6 relative overflow-hidden bg-background min-h-[calc(100svh-3.5rem)]">
      <HeritageMindMapClient />
    </div>
  );
}
