"use client";

import Link from "next/link";
import { IconLayoutDashboard, IconBell } from '@tabler/icons-react';

export default function SiteHeader() {
  return (
    <header className="w-full bg-transparent fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/cair-logo/fulllogo_nobuffer.png" alt="HeritageGraph" className="h-10" />
            <span className="font-bold text-lg text-white">Heritage Graph</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-4">
          <Link href="#features" className="text-white/90 hover:text-white">Features</Link>
          <Link href="#about" className="text-white/90 hover:text-white">About</Link>
          <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20">
            <IconLayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <button aria-label="Notifications" className="p-2 rounded bg-white/10 text-white hover:bg-white/20">
            <IconBell className="w-5 h-5" />
          </button>
          <Link href="/dashboard" className="px-4 py-2 rounded bg-white text-slate-900 font-semibold">Sign In</Link>
        </div>
      </div>
    </header>
  );
}
