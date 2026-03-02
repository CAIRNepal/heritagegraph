'use client';

import React from 'react';
import { ReactNode } from 'react';
import { AppSidebar } from '@/app/dashboard/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import AuthButtons from '@/components/AuthButtons';
import { NotificationBell } from '@/components/notification-bell';
import { Toaster } from '@/components/ui/sonner';
import Image from 'next/image';
import Link from 'next/link';
import { Github, Mail, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({ children }: { children: ReactNode }) {
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
            <NotificationBell />
            <AuthButtons />
            <ThemeToggle />
          </div>
        </header>

        {/* ── Main Content ── */}
        <main
          role="main"
          className="flex flex-col flex-1 @container/main gap-4 py-6 px-4 md:px-6 bg-gradient-to-br from-blue-50/50 via-sky-50/30 to-blue-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950"
        >
          {children}
        </main>

        {/* ── Footer ── */}
        <footer className="px-6 py-6 border-t border-blue-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <Image src="/cair-logo/fulllogo_nobuffer.png" alt="CAIR-Nepal" width={120} height={40} className="h-8 w-auto" />
              <Image src="/logo.svg" alt="HeritageGraph" width={100} height={32} className="h-7 w-auto" />
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              &copy; {new Date().getFullYear()} HeritageGraph. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors" asChild>
                <a href="https://github.com/CAIRNepal/heritagegraph" target="_blank" rel="noopener noreferrer"><Github className="w-4 h-4" /></a>
              </Button>
              <Button variant="ghost" size="icon" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors" asChild>
                <a href="mailto:info@cair-nepal.org"><Mail className="w-4 h-4" /></a>
              </Button>
              <Button variant="ghost" size="icon" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors" asChild>
                <a href="https://www.cair-nepal.org/" target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
              </Button>
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
