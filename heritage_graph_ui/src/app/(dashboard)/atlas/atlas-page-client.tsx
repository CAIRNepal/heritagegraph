'use client';

import dynamic from 'next/dynamic';

import { AtlasShellLoading } from './components/atlas-loading-fallbacks';

const AtlasLoader = dynamic(() => import('./atlas-client'), {
  ssr: false,
  loading: () => <AtlasShellLoading />,
});

export function AtlasPageClient() {
  return <AtlasLoader />;
}
