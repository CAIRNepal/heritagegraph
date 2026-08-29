'use client';

/**
 * The public shell: top bar, page, footer. No sidebar.
 *
 * WHY THIS EXISTS
 * The entry page used to render inside the workspace shell, so a first-time
 * visitor was met by a sidebar listing Contributions Queue, Activity Log and
 * Browse by type — a contributor's tools, before they had been told what the
 * platform is. Reading surfaces get this shell; the workspace keeps its
 * sidebar.
 *
 * The bar and the footer come from `site-chrome`, the same ones the workspace
 * shell renders, so crossing between the two changes the page and nothing else.
 *
 * `@container/main` on the main element is not decoration: the tables and card
 * grids used by these pages size themselves against it, and without it they
 * fall back to their narrowest layout.
 */

import { ReactNode } from 'react';

import { ApiBaseWarning } from '@/components/api-base-warning';
import { CommandMenu } from '@/components/command-menu';
import { DegradedSchemaBanner } from '@/components/ontology/DegradedSchemaBanner';
import { HeaderControls, SiteBar, SiteFooter } from '@/components/site-chrome';
import { SiteNav } from '@/components/site-nav';
import { Toaster } from '@/components/ui/sonner';
import { WelcomeDialog } from '@/components/welcome-dialog';
import { ChatContextWrapper } from '@/providers/ChatContextWrapper';
import { OntologyProvider } from '@/lib/ontology/OntologyProvider';
import { PwaRegister } from '@/components/pwa-register';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <OntologyProvider>
      <PwaRegister />
      <div className="flex min-h-svh flex-col bg-background">
        <ApiBaseWarning />
        <DegradedSchemaBanner />

        <SiteBar>
          <SiteNav />
          <HeaderControls />
        </SiteBar>

        <main
          role="main"
          className="@container/main flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 md:px-6"
        >
          {children}
        </main>

        <SiteFooter />
      </div>

      <Toaster
        position="top-center"
        richColors
        closeButton
        expand
        toastOptions={{ duration: 4000 }}
      />
      <CommandMenu />
      <WelcomeDialog />
      <ChatContextWrapper surface="dashboard">
        <></>
      </ChatContextWrapper>
    </OntologyProvider>
  );
}
