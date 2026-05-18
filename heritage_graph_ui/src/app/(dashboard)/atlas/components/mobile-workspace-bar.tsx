'use client';

import { IconLayoutGrid } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { useAtlasStore, type AtlasSidebarPanelId } from '../hooks/use-atlas-store';
import { AiReasoningView } from '../views/ai-view';
import { DocumentsView } from '../views/documents-view';
import { GraphView } from '../views/graph-view';
import { OpsDashboardView } from '../views/ops-view';
import { SearchView } from '../views/search-view';
import { TimeView } from '../views/time-view';
import { FxControls } from './fx-controls';
import { CityJumpBar } from './city-jump-bar';
import type { RefObject } from 'react';
import type { AtlasGlobeHandles } from '@/app/(dashboard)/atlas/globe-handles';

const PANELS: { id: AtlasSidebarPanelId; labelKey: 'viewSearch' | 'viewGraph' | 'viewDocuments' | 'viewTime' | 'viewAi' | 'viewOps' | 'fxTitle' | 'cityJumpTitle' }[] = [
  { id: 'search', labelKey: 'viewSearch' },
  { id: 'graph', labelKey: 'viewGraph' },
  { id: 'documents', labelKey: 'viewDocuments' },
  { id: 'time', labelKey: 'viewTime' },
  { id: 'ai', labelKey: 'viewAi' },
  { id: 'ops', labelKey: 'viewOps' },
  { id: 'fx', labelKey: 'fxTitle' },
  { id: 'city', labelKey: 'cityJumpTitle' },
];

interface MobileWorkspaceBarProps {
  globeHandlesRef: RefObject<AtlasGlobeHandles | null>;
}

export function MobileWorkspaceBar({ globeHandlesRef }: MobileWorkspaceBarProps) {
  const t = useTranslations('Atlas');
  const activeSidebarPanel = useAtlasStore((s) => s.activeSidebarPanel);
  const openSidebarPanel = useAtlasStore((s) => s.openSidebarPanel);
  const closeSidebarPanel = useAtlasStore((s) => s.closeSidebarPanel);

  const panelBody = (id: AtlasSidebarPanelId) => {
    switch (id) {
      case 'search':
        return <SearchView compact />;
      case 'graph':
        return <GraphView compact className="min-h-[240px]" />;
      case 'documents':
        return <DocumentsView compact />;
      case 'time':
        return <TimeView compact />;
      case 'ai':
        return <AiReasoningView compact />;
      case 'ops':
        return <OpsDashboardView compact />;
      case 'fx':
        return <FxControls variant="dock" className="!max-h-none p-2" />;
      case 'city':
        return <CityJumpBar globeHandlesRef={globeHandlesRef} />;
      default:
        return null;
    }
  };

  return (
    <div className="pointer-events-auto absolute bottom-[calc(0.5rem+var(--atlas-dock-h,80px)+0.5rem)] right-2 z-30 flex gap-1 lg:hidden">
      <Sheet
        open={activeSidebarPanel != null}
        onOpenChange={(open) => {
          if (!open) closeSidebarPanel();
        }}
      >
        <SheetTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1 rounded-full shadow-md"
            onClick={() => openSidebarPanel(activeSidebarPanel ?? 'search')}
          >
            <IconLayoutGrid className="h-3.5 w-3.5" aria-hidden />
            <span className="font-mono text-[10px] uppercase">{t('mobilePanels')}</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-hidden p-0"
          aria-describedby={undefined}
        >
          <SheetHeader className="border-b border-border/60 px-4 py-3">
            <SheetTitle className="font-mono text-xs uppercase tracking-wide">
              {activeSidebarPanel ?
                t(PANELS.find((p) => p.id === activeSidebarPanel)?.labelKey ?? 'statusStripWorkspace')
              : t('statusStripWorkspace')}
            </SheetTitle>
          </SheetHeader>
          <div className="flex gap-1 overflow-x-auto border-b border-border/50 px-2 py-2">
            {PANELS.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={activeSidebarPanel === p.id ? 'default' : 'outline'}
                className="h-7 shrink-0 text-[10px]"
                onClick={() => openSidebarPanel(p.id)}
              >
                {t(p.labelKey)}
              </Button>
            ))}
          </div>
          <div className="max-h-[calc(85vh-7rem)] overflow-auto p-2">
            {activeSidebarPanel ? panelBody(activeSidebarPanel) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
