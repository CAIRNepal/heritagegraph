import { Suspense } from 'react';

import { AtlasPageClient } from './atlas-page-client';
import { AtlasShellLoading } from './components/atlas-loading-fallbacks';

export default function AtlasPage() {
  return (
    <div className="flex flex-col flex-1 -my-4 -mx-4 md:-mx-6 relative overflow-hidden bg-background shadow-2xl">
      <Suspense fallback={<AtlasShellLoading />}>
        <AtlasPageClient />
      </Suspense>
    </div>
  );
}
