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
      <div className="h-5 w-px bg-blue-200 dark:bg-gray-700" />

      {/* Logo / brand — links back to landing */}
      <Link
        href="/"
        className="flex items-center gap-2 group transition-opacity hover:opacity-80"
      >
        <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-sky-600 rounded-lg flex items-center justify-center shadow-sm">
          <BookOpen className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-semibold text-sm hidden sm:inline bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
          HeritageGraph
        </span>
      </Link>
    </div>
  );
}
