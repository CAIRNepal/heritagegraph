import { AtlasPageClient } from './atlas-page-client';

export default function AtlasPage() {
  return (
    <div className="flex flex-col flex-1 -my-4 -mx-4 md:-mx-6 relative overflow-hidden bg-background shadow-2xl">
      <AtlasPageClient />
    </div>
  );
}
