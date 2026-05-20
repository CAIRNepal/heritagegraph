'use client';

import dynamic from 'next/dynamic';

import { AtlasErrorBoundary } from './components/atlas-error-boundary';
import { AtlasShellLoading } from './components/atlas-loading-fallbacks';

const AtlasLoader = dynamic(() => import('./atlas-client'), {
  ssr: false,
  loading: () => <AtlasShellLoading />,
});

export function AtlasPageClient() {
  return (
    <AtlasErrorBoundary>
      <AtlasLoader />
    </AtlasErrorBoundary>
  );
}
