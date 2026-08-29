'use client';

import React from 'react';
import { ReactNode } from 'react';
import { AppSidebar } from '@/app/(dashboard)/components/app-sidebar';
import { HeaderControls, SiteBar, SiteFooter } from '@/components/site-chrome';
import { SiteNav } from '@/components/site-nav';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { ChatContextWrapper } from '@/providers/ChatContextWrapper';
import { ApiBaseWarning } from '@/components/api-base-warning';
import { CommandMenu } from '@/components/command-menu';
import { WelcomeDialog } from '@/components/welcome-dialog';
import { OntologyProvider } from '@/lib/ontology/OntologyProvider';
import { DegradedSchemaBanner } from '@/components/ontology/DegradedSchemaBanner';
import { PwaRegister } from '@/components/pwa-register';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <OntologyProvider>
    <PwaRegister />
    <SidebarProvider
      className="min-h-svh"
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 14)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="sidebar" />

      {/*
        SidebarInset renders its own <main>, which nested inside the explicit
        <main role="main"> below and gave the document two main landmarks.
        role="presentation" strips the implicit landmark from the wrapper
        without modifying the shadcn primitive, leaving one banner, one main
        and one contentinfo — and none of them nested inside another.

        min-w-0 fixes a separate, pre-existing bug: the inset carries w-full
        while sitting in a flex row beside an 18rem sidebar, so from the md
        breakpoint up to roughly 1024px the shell was ~175px wider than the
        viewport and every page scrolled sideways. A flex item will not shrink
        below its content without min-width: 0.
      */}
      <SidebarInset role="presentation" className="min-w-0">
        <ApiBaseWarning />
        <DegradedSchemaBanner />
        {/* ── Bar ── the same one the public shell renders, plus the trigger
             for the sidebar this shell has. ── */}
        <SiteBar>
          <SiteNav withSidebarTrigger />
          <HeaderControls />
        </SiteBar>

        {/* ── Main Content ── */}
        <main
          role="main"
          className="flex min-h-0 flex-1 flex-col @container/main gap-3 bg-background px-4 py-4 md:px-6"
        >
          {children}
        </main>

        <SiteFooter />

      </SidebarInset>
      
      {/* Global Toast Notifications */}
      <Toaster 
        position="top-center" 
        richColors 
        closeButton 
        expand={true}
        toastOptions={{
          duration: 4000,
        }}
      />

      {/* Global ⌘K command palette + first-visit onboarding */}
      <CommandMenu />
      <WelcomeDialog />

      {/* Chat Widget */}
      <ChatContextWrapper surface="dashboard">
        <></>
      </ChatContextWrapper>
    </SidebarProvider>
    </OntologyProvider>
  );
}
