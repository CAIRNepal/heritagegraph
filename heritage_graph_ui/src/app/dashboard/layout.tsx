'use client';

import React from 'react';
import { ReactNode } from 'react';
import { AppSidebar } from '@/app/dashboard/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import AuthButtons from '@/components/AuthButtons';
import Image from 'next/image';

// export const metadata: Metadata = {
//   title: "Heritage Graph Dashboard",
//   description: "Collaborative moderation, submission, and curation interface.",
// }

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="sidebar" />

      <SidebarInset>
        <header
          className="flex items-center justify-between px-4 h-12 border-b border-border bg-background"
          role="banner"
          aria-label="Dashboard Header"
        >
          <SiteHeader compact />

          <div className="ml-auto flex items-center gap-3">
            <AuthButtons />
            <ThemeToggle />
          </div>
        </header>

        <main
          role="main"
          className="flex flex-col flex-1 @container/main gap-4 py-6 px-4 md:px-6"
        >
          {children}
        </main>

        <footer className="px-6 py-4 border-t border-border flex flex-col md:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <Image src="/cair-logo/fulllogo_nobuffer.png" alt="HeritageGraph" width={150} height={150} />
            <Image src="/logo.svg" alt="Partner Logo" width={100} height={100} />
          </div>
          <div className="mt-2 md:mt-0">
            &copy; 2025 HeritageGraph. All rights reserved.
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
