"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, Bell, Menu, X } from 'lucide-react';

export default function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`w-full fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-slate-900/90 backdrop-blur-md border-b border-white/10 shadow-lg'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <img src="/cair-logo/fulllogo_nobuffer.png" alt="HeritageGraph" className="h-9" />
          <span className="font-bold text-lg text-white">Heritage Graph</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="#explore" className="text-white/80 hover:text-white text-sm font-medium transition-colors">Explore</Link>
          <Link href="#about" className="text-white/80 hover:text-white text-sm font-medium transition-colors">About</Link>
          <Link href="#contact" className="text-white/80 hover:text-white text-sm font-medium transition-colors">Contact</Link>
        </nav>

        {/* Right controls */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-white text-slate-900 hover:bg-white/90 transition-colors"
          >
            Sign In
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden bg-slate-900/95 backdrop-blur-md border-t border-white/10 px-6 py-4 flex flex-col gap-4">
          <Link href="#explore" className="text-white/80 hover:text-white text-sm" onClick={() => setMobileOpen(false)}>Explore</Link>
          <Link href="#about" className="text-white/80 hover:text-white text-sm" onClick={() => setMobileOpen(false)}>About</Link>
          <Link href="#contact" className="text-white/80 hover:text-white text-sm" onClick={() => setMobileOpen(false)}>Contact</Link>
          <Link href="/dashboard" className="text-white/80 hover:text-white text-sm flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
          <Link href="/dashboard" className="px-4 py-2 text-sm font-semibold rounded-lg bg-white text-slate-900 text-center" onClick={() => setMobileOpen(false)}>Sign In</Link>
        </div>
      )}
    </header>
  );
}
