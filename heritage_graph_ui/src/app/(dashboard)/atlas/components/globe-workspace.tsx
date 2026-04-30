'use client';

import type { RefObject } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { IconMaximize, IconMinimize } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import type { AtlasGlobeHandles } from '@/app/(dashboard)/atlas/globe-handles';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AtlasViewId } from '@/types/atlas';

import { AtlasGlobe } from './globe';
import { CityJumpBar } from './city-jump-bar';
import { FxControls } from './fx-controls';
import { SpotlightDisc } from './spotlight-frame';
import { useAtlasStore } from '../hooks/use-atlas-store';
import { AiReasoningView } from '../views/ai-view';
import { DocumentsView } from '../views/documents-view';
import { OpsDashboardView } from '../views/ops-view';
import { SearchView } from '../views/search-view';
import { TimeView } from '../views/time-view';

const GraphView = dynamic(
  () => import('../views/graph-view').then((m) => ({ default: m.GraphView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[120px] items-center justify-center font-mono text-[10px] text-muted-foreground">
        …
      </div>
    ),
  },
);

export type AtlasPanelId = Exclude<AtlasViewId, 'globe'>;

const PANEL_TITLE: Record<
  AtlasPanelId,
  'viewGraph' | 'viewDocuments' | 'viewTime' | 'viewSearch' | 'viewAi' | 'viewOps'
> = {
  graph: 'viewGraph',
  documents: 'viewDocuments',
  time: 'viewTime',
  search: 'viewSearch',
  ai: 'viewAi',
  ops: 'viewOps',
};

interface GlobeWorkspaceProps {
  globeHandlesRef: RefObject<AtlasGlobeHandles | null>;
  shellRef: RefObject<HTMLElement | null>;
}

function MiniPanel({
  viewId,
  className,
  children,
}: {
  viewId: AtlasPanelId;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('Atlas');
  const focusView = useAtlasStore((s) => s.focusView);

  return (
    <div
      className={cn(
        'atlas-card flex min-h-0 flex-col overflow-hidden',
        className,
      )}
    >
      <div className="atlas-card-header shrink-0">
        <span className="truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {t(PANEL_TITLE[viewId])}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-md"
          onClick={() => focusView(viewId)}
          aria-label={t('maximizePanel')}
          title={t('maximizePanel')}
        >
          <IconMaximize className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

/** Full-shell maximized panel overlay — rendered at the atlas-client level, not inside the disc mask. */
export function FocusedShellOverlay() {
  const t = useTranslations('Atlas');
  const focusedView = useAtlasStore((s) => s.focusedView);
  const focusView = useAtlasStore((s) => s.focusView);

  const view =
    focusedView && focusedView !== 'globe' ? (focusedView as AtlasPanelId) : null;

  const body = (() => {
    switch (view) {
      case 'graph':
        return <GraphView compact={false} />;
      case 'documents':
        return <DocumentsView compact={false} />;
      case 'time':
        return <TimeView compact={false} />;
      case 'search':
        return <SearchView compact={false} />;
      case 'ai':
        return <AiReasoningView compact={false} />;
      case 'ops':
        return <OpsDashboardView compact={false} />;
      default:
        return null;
    }
  })();

  return (
    <AnimatePresence mode="wait">
      {view ?
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden bg-background/[0.97] backdrop-blur-md"
          style={{ top: 'calc(var(--atlas-bar-h, 40px) + 0.5rem)' }}
        >
          <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/90 px-3">
            <span className="truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {t(PANEL_TITLE[view])}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-md"
              onClick={() => focusView(null)}
              aria-label={t('minimizePanel')}
              title={t('minimizePanel')}
            >
              <IconMinimize className="h-4 w-4" />
            </Button>
          </div>
          <div
            className={cn(
              'min-h-0 flex-1 overflow-auto',
              view === 'graph' && '[filter:var(--atlas-fx-filter)]',
            )}
          >
            {body}
          </div>
        </motion.div>
      : null}
    </AnimatePresence>
  );
}

export function GlobeWorkspace({ globeHandlesRef, shellRef }: GlobeWorkspaceProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-0 grid min-h-0 gap-2 px-2 pb-2 pt-[calc(0.25rem+var(--atlas-bar-h,40px))]',
        'grid-cols-1 auto-rows-auto',
        'lg:atlas-grid-areas',
      )}
    >
      {/* Row 1 — top: graph (left) · [gap center] · search (right) */}
      <div
        className="pointer-events-auto order-2 min-h-[140px] lg:order-none lg:min-h-0"
        style={{ gridArea: 'graph' }}
      >
        <MiniPanel viewId="graph" className="h-full min-h-[140px] lg:min-h-[120px]">
          <GraphView compact className="[filter:var(--atlas-fx-filter)]" />
        </MiniPanel>
      </div>

      <div
        className="pointer-events-auto order-3 min-h-[160px] lg:order-none"
        style={{ gridArea: 'search' }}
      >
        <MiniPanel viewId="search" className="h-full min-h-[160px]">
          <SearchView compact />
        </MiniPanel>
      </div>

      {/* Row 2 — middle: left dock · disc · right dock */}
      <div
        className="pointer-events-auto order-4 flex min-h-0 flex-col gap-2 lg:order-none"
        style={{ gridArea: 'leftDock' }}
      >
        <div className="atlas-card max-h-[38vh] min-h-0 shrink-0 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
          <FxControls variant="dock" className="!max-h-none shrink-0" />
        </div>
        <MiniPanel viewId="documents" className="min-h-[160px] flex-1 lg:min-h-[140px]">
          <DocumentsView compact />
        </MiniPanel>
      </div>

      <div
        className="pointer-events-auto relative order-1 min-h-[260px] lg:order-none lg:min-h-0"
        style={{ gridArea: 'disc' }}
      >
        <SpotlightDisc shellRef={shellRef} globeFxClassName="[filter:var(--atlas-fx-filter)]">
          <AtlasGlobe globeHandlesRef={globeHandlesRef} />
        </SpotlightDisc>
      </div>

      <div
        className="pointer-events-auto order-5 flex min-h-0 flex-col gap-2 lg:order-none"
        style={{ gridArea: 'rightDock' }}
      >
        <div className="atlas-card max-h-[38vh] min-h-0 shrink-0 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
          <CityJumpBar globeHandlesRef={globeHandlesRef} />
        </div>
        <MiniPanel viewId="ops" className="min-h-[160px] flex-1">
          <OpsDashboardView compact />
        </MiniPanel>
      </div>

      {/* Row 3 — bottom: time (left) · [gap center] · ai (right) */}
      <div
        className="pointer-events-auto order-6 min-h-[140px] lg:order-none lg:min-h-0"
        style={{ gridArea: 'time' }}
      >
        <MiniPanel viewId="time" className="h-full min-h-[140px]">
          <TimeView compact />
        </MiniPanel>
      </div>

      <div
        className="pointer-events-auto order-7 min-h-[160px] lg:order-none lg:min-h-0"
        style={{ gridArea: 'ai' }}
      >
        <MiniPanel viewId="ai" className="h-full min-h-[160px]">
          <AiReasoningView compact />
        </MiniPanel>
      </div>
    </div>
  );
}
