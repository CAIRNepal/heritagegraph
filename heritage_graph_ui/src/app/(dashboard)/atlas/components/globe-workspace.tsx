'use client';

import type { RefObject } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { IconChevronDown, IconChevronUp, IconMaximize, IconMinimize } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import type { AtlasGlobeHandles } from '@/app/(dashboard)/atlas/globe-handles';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AtlasViewId } from '@/types/atlas';

import { AtlasGlobe } from './globe';
import { CityJumpBar } from './city-jump-bar';
import { FxControls } from './fx-controls';
import { SpotlightDisc } from './spotlight-frame';
import { useAtlasStore, type AtlasSidebarPanelId } from '../hooks/use-atlas-store';
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

function SidebarAccordionItem({
  panelId,
  title,
  canMaximize = false,
  onMaximize,
  children,
}: {
  panelId: AtlasSidebarPanelId;
  title: string;
  canMaximize?: boolean;
  onMaximize?: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations('Atlas');
  const activeSidebarPanel = useAtlasStore((s) => s.activeSidebarPanel);
  const toggleSidebarPanel = useAtlasStore((s) => s.toggleSidebarPanel);
  const active = activeSidebarPanel === panelId;

  return (
    <div className="atlas-card flex min-h-0 flex-col overflow-hidden">
      <div className="atlas-card-header shrink-0">
        <span className="truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md"
            onClick={() => toggleSidebarPanel(panelId)}
            aria-label={active ? t('collapsePanel') : t('expandPanel')}
            title={active ? t('collapsePanel') : t('expandPanel')}
          >
            {active ?
              <IconChevronUp className="h-3.5 w-3.5" />
            : <IconChevronDown className="h-3.5 w-3.5" />}
          </Button>
          {canMaximize && onMaximize ?
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md"
              onClick={onMaximize}
              aria-label={t('maximizePanel')}
              title={t('maximizePanel')}
            >
              <IconMaximize className="h-3.5 w-3.5" />
            </Button>
          : null}
        </div>
      </div>
      {active ? <div className="h-[min(42vh,360px)] min-h-[170px] overflow-hidden">{children}</div> : null}
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
  const t = useTranslations('Atlas');
  const focusView = useAtlasStore((s) => s.focusView);

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-0 flex min-h-0 gap-2 px-2 pb-2 pt-[calc(0.25rem+var(--atlas-bar-h,40px))]',
      )}
    >
      <div className="pointer-events-auto relative min-w-0 flex-1">
        <SpotlightDisc shellRef={shellRef} globeFxClassName="[filter:var(--atlas-fx-filter)]">
          <AtlasGlobe globeHandlesRef={globeHandlesRef} />
        </SpotlightDisc>
      </div>

      <aside className="pointer-events-auto atlas-card hidden h-full w-[min(27rem,36vw)] min-w-[19rem] max-w-[28rem] flex-col overflow-hidden lg:flex">
        <div className="atlas-card-header">
          <span className="truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('statusStripWorkspace')}
          </span>
        </div>
        <div className="atlas-sidebar-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          <SidebarAccordionItem panelId="fx" title={t('fxTitle')}>
            <FxControls variant="dock" className="!max-h-none h-full p-2" />
          </SidebarAccordionItem>

          <SidebarAccordionItem panelId="city" title={t('cityJumpTitle')}>
            <div className="h-full overflow-auto">
              <CityJumpBar globeHandlesRef={globeHandlesRef} />
            </div>
          </SidebarAccordionItem>

          <SidebarAccordionItem
            panelId="search"
            title={t(PANEL_TITLE.search)}
            canMaximize
            onMaximize={() => focusView('search')}
          >
            <SearchView compact />
          </SidebarAccordionItem>

          <SidebarAccordionItem
            panelId="graph"
            title={t(PANEL_TITLE.graph)}
            canMaximize
            onMaximize={() => focusView('graph')}
          >
            <GraphView compact className="h-full [filter:var(--atlas-fx-filter)]" />
          </SidebarAccordionItem>

          <SidebarAccordionItem
            panelId="documents"
            title={t(PANEL_TITLE.documents)}
            canMaximize
            onMaximize={() => focusView('documents')}
          >
            <DocumentsView compact />
          </SidebarAccordionItem>

          <SidebarAccordionItem
            panelId="time"
            title={t(PANEL_TITLE.time)}
            canMaximize
            onMaximize={() => focusView('time')}
          >
            <TimeView compact />
          </SidebarAccordionItem>

          <SidebarAccordionItem
            panelId="ai"
            title={t(PANEL_TITLE.ai)}
            canMaximize
            onMaximize={() => focusView('ai')}
          >
            <AiReasoningView compact />
          </SidebarAccordionItem>

          <SidebarAccordionItem
            panelId="ops"
            title={t(PANEL_TITLE.ops)}
            canMaximize
            onMaximize={() => focusView('ops')}
          >
            <OpsDashboardView compact />
          </SidebarAccordionItem>
        </div>
      </aside>
    </div>
  );
}
