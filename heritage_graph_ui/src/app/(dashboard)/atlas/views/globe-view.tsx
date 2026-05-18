'use client';

import type { RefObject } from 'react';

import type { AtlasGlobeHandles } from '@/app/(dashboard)/atlas/globe-handles';

import { EntityHoverCard } from '../components/entity-hover-card';
import { GlobeWorkspace } from '../components/globe-workspace';
import { MobileWorkspaceBar } from '../components/mobile-workspace-bar';

interface GlobeViewProps {
  globeHandlesRef: RefObject<AtlasGlobeHandles | null>;
  shellRef: RefObject<HTMLElement | null>;
}

export function GlobeView({ globeHandlesRef, shellRef }: GlobeViewProps) {
  return (
    <>
      <GlobeWorkspace globeHandlesRef={globeHandlesRef} shellRef={shellRef} />
      <MobileWorkspaceBar globeHandlesRef={globeHandlesRef} />
      <EntityHoverCard />
    </>
  );
}
