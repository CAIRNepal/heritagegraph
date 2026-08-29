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
    {/*
      The bar sits ABOVE the sidebar, not beside it.

      It used to render inside the sidebar inset, which made it 597px wide at a
      900px viewport and 812px at 1440 — not enough for the nav links, so they
      collapsed to a hamburger on every workspace page while the public pages
      showed them in full. Crossing between the two felt like changing site,
      which is the one thing this bar exists to prevent.

      Full width, it fits everywhere and is now literally identical on every
      page. The sidebar starts below it (`top-14`, matching the bar's h-14) so
      the two do not overlap.
    */}
    <SidebarProvider
      className="min-h-svh flex-col"
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 14)',
        } as React.CSSProperties
      }
    >
      <SiteBar>
        <SiteNav withSidebarTrigger />
        <HeaderControls />
      </SiteBar>

      <div className="flex min-h-0 w-full flex-1">
      <AppSidebar variant="sidebar" className="top-14 h-[calc(100svh-3.5rem)]" />

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
        {/* Banners sit below the bar, so the bar stays at y=0 and the sidebar's
            `top-14` offset stays correct whether or not one is showing. */}
        <ApiBaseWarning />
        <DegradedSchemaBanner />

        {/* ── Main Content ── */}
        <main
          role="main"
          className="flex min-h-0 flex-1 flex-col @container/main gap-3 bg-background px-4 py-4 md:px-6"
        >
          {children}
        </main>

        <SiteFooter />

      </SidebarInset>
      </div>
      
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
