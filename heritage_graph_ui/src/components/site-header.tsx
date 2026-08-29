'use client';

import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';

/**
 * Dashboard top-bar header.
 * Slim bar with sidebar trigger + brand link.
 * Navigation is handled entirely by the sidebar.
 */
export function SiteHeader() {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {/* Sidebar toggle */}
      <SidebarTrigger />

      {/* Separator */}
      <div className="h-5 w-px bg-border" />

      {/* Logo / brand — links back to landing */}
      <Link
        href="/"
        className="flex items-center gap-2 group transition-opacity hover:opacity-80"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
          <BookOpen className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="hidden font-serif text-sm font-semibold text-foreground @[30rem]/header:inline">
          HeritageGraph
        </span>
      </Link>
    </div>
  );
}
