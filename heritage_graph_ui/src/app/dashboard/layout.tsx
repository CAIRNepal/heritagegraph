'use client';

import React from 'react';
import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AppSidebar } from '@/app/dashboard/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import AuthButtons from '@/components/AuthButtons';
import { NotificationBell } from '@/components/notification-bell';
import { Toaster } from '@/components/ui/sonner';
import { UserProgressBadge } from '@/components/progression-widgets';
import { LanguageSwitcher } from '@/components/language-switcher';

import Image from 'next/image';
import { Github, Mail, ExternalLink } from 'lucide-react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 14)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="sidebar" />

      <SidebarInset>
        {/* ── Header ── */}
        <header
          className="sticky top-0 z-40 flex items-center px-4 md:px-6 h-14 border-b border-blue-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl transition-all duration-300"
          role="banner"
          aria-label="Dashboard Header"
        >
          <SiteHeader />

          <div className="ml-auto flex items-center gap-3 flex-shrink-0">

            <UserProgressBadge />
            <NotificationBell />
            <LanguageSwitcher />
            <AuthButtons />
            <ThemeToggle />
          </div>
        </header>

        {/* ── Main Content ── */}
        <main
          role="main"
          className="flex flex-col flex-1 @container/main gap-3 py-4 px-4 md:px-6 bg-gradient-to-br from-blue-50/50 via-sky-50/30 to-blue-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950"
        >
          {children}
        </main>

        {/* ── Footer ── */}
        <footer className="px-4 md:px-6 py-2 border-t border-blue-200/60 dark:border-gray-700/60 bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4 text-xs text-blue-600/70 dark:text-blue-400/60">
            <div className="flex items-center gap-3">
              <Image src="/cair-logo/fulllogo_nobuffer.png" alt="CAIR-Nepal" width={80} height={28} className="h-5 w-auto opacity-70" />
              <span className="hidden sm:inline">{t('copyright', { year: new Date().getFullYear() })}</span>
            </div>
            <div className="flex items-center gap-1">
              <a href="https://github.com/CAIRNepal/heritagegraph" target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:text-blue-800 dark:hover:text-blue-200 transition-colors">
                <Github className="w-3.5 h-3.5" />
              </a>
              <a href="mailto:info@cair-nepal.org" className="p-1 rounded hover:text-blue-800 dark:hover:text-blue-200 transition-colors">
                <Mail className="w-3.5 h-3.5" />
              </a>
              <a href="https://www.cair-nepal.org/" target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:text-blue-800 dark:hover:text-blue-200 transition-colors">
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
    </SidebarProvider>
  );
}
