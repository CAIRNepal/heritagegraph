'use client';

import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import Link from 'next/link';
import {
  IconBell,
} from '@tabler/icons-react';

/**
 * Dashboard top-bar header.
 * Always rendered in compact mode (slim bar with logo + user controls).
 * Navigation is handled entirely by the sidebar.
 */
export function SiteHeader({ compact = true }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 w-full">
      {/* Sidebar toggle */}
      <SidebarTrigger />

      {/* Logo / brand */}
      <Link href="/" className="flex items-center gap-2">
        <img
          src="/cair-logo/fulllogo_nobuffer.png"
          alt="HeritageGraph"
          className="h-7 w-auto"
        />
        <span className="font-semibold text-sm hidden sm:inline">Heritage Graph</span>
      </Link>
    </div>
  );
}
