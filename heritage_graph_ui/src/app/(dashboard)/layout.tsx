'use client';

import React from 'react';
import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { AppSidebar } from '@/app/(dashboard)/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import AuthButtons from '@/components/AuthButtons';

const NotificationBell = dynamic(
  () => import('@/components/notification-bell').then((mod) => mod.NotificationBell),
  { ssr: false }
);
import { Toaster } from '@/components/ui/sonner';
import { UserProgressBadge } from '@/components/progression-widgets';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ChatContextWrapper } from '@/providers/ChatContextWrapper';
import { ApiBaseWarning } from '@/components/api-base-warning';
import { CommandMenu, CommandMenuTrigger } from '@/components/command-menu';
import { WelcomeDialog } from '@/components/welcome-dialog';
import { OntologyProvider } from '@/lib/ontology/OntologyProvider';
import { DegradedSchemaBanner } from '@/components/ontology/DegradedSchemaBanner';
import { PwaRegister } from '@/components/pwa-register';

import Image from 'next/image';
import { Github, Mail, ExternalLink } from 'lucide-react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const { status } = useSession();
  const showAuthedHeader = status === 'authenticated';

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
        {/* ── Header ── */}
        <header
          className="sticky top-0 z-40 flex items-center px-4 md:px-6 h-14 border-b border-border bg-background/85 backdrop-blur-xl transition-all duration-300"
          role="banner"
          aria-label="Dashboard Header"
        >
          <SiteHeader />

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">

            <CommandMenuTrigger />
            {showAuthedHeader ? <UserProgressBadge /> : null}
            {showAuthedHeader ? <NotificationBell /> : null}
            <LanguageSwitcher />
            <AuthButtons />
            <ThemeToggle />
          </div>
        </header>

        {/* ── Main Content ── */}
        <main
          role="main"
          className="flex min-h-0 flex-1 flex-col @container/main gap-3 bg-background px-4 py-4 md:px-6"
        >
          {children}
        </main>

        {/* ── Footer ── */}
        <footer className="px-4 md:px-6 py-2 border-t border-border bg-card/40 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <Image
                src="/cair-logo/fulllogo_nobuffer.png"
                alt="CAIR-Nepal"
                width={80}
                height={28}
                className="opacity-70"
                // next/image warns when CSS overrides one dimension but not the
                // other; stating both keeps the intrinsic aspect ratio explicit.
                style={{ height: '1.25rem', width: 'auto' }}
                sizes="80px"
              />
              <span className="hidden sm:inline">{t('copyright', { year: new Date().getFullYear() })}</span>
            </div>
            <div className="flex items-center gap-1">
              <a href="https://github.com/CAIRNepal/heritagegraph" target="_blank" rel="noopener noreferrer" className="rounded p-1 transition-colors hover:text-foreground focus-visible:text-foreground">
                <Github className="w-3.5 h-3.5" />
              </a>
              <a href="mailto:info@cair-nepal.org" className="rounded p-1 transition-colors hover:text-foreground focus-visible:text-foreground">
                <Mail className="w-3.5 h-3.5" />
              </a>
              <a href="https://www.cair-nepal.org/" target="_blank" rel="noopener noreferrer" className="rounded p-1 transition-colors hover:text-foreground focus-visible:text-foreground">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </footer>
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
