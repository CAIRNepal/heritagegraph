'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { appPath } from '@/lib/config';

interface PublicSiteHeaderProps {
  variant?: 'marketing' | 'record';
}

export function PublicSiteHeader({ variant = 'marketing' }: PublicSiteHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-primary/25 bg-primary text-primary-foreground shadow-md">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {variant === 'record' ? (
            <>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/95 hover:text-primary-foreground"
              >
                ← Back to discovery
              </Link>
              <span className="hidden h-4 w-px bg-primary-foreground/25 sm:inline" />
              <Link href="/" className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-foreground/15">
                  <BookOpen className="h-4 w-4 text-primary-foreground" />
                </span>
                <span
                  className="truncate text-lg font-semibold leading-tight tracking-tight"
                  style={{ fontFamily: 'var(--font-display), ui-serif, serif' }}
                >
                  HeritageGraph
                </span>
              </Link>
            </>
          ) : (
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-foreground/15">
                <BookOpen className="h-4 w-4 text-primary-foreground" />
              </span>
              <div>
                <p
                  className="text-lg font-semibold leading-tight tracking-tight sm:text-xl"
                  style={{ fontFamily: 'var(--font-display), ui-serif, serif' }}
                >
                  HeritageGraph
                </p>
                <p className="text-[11px] font-normal text-primary-foreground/80 sm:text-xs">
                  Collections discovery
                </p>
              </div>
            </Link>
          )}
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
          <Link
            href={appPath('/')}
            className="text-primary-foreground/90 hover:text-primary-foreground hover:underline underline-offset-4"
          >
            Open app
          </Link>
          <Link
            href={appPath('/graphview')}
            className="text-primary-foreground/90 hover:text-primary-foreground hover:underline underline-offset-4"
          >
            Graph
          </Link>
          <a
            href="#search-tips"
            className="text-primary-foreground/90 hover:text-primary-foreground hover:underline underline-offset-4"
          >
            Search tips
          </a>
          <a
            href="https://github.com/CAIRNepal/heritagegraph"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-foreground/90 hover:text-primary-foreground hover:underline underline-offset-4"
          >
            GitHub
          </a>
          <span className="hidden h-4 w-px bg-primary-foreground/30 sm:inline" />
          <Link
            href={appPath('/auth/login')}
            className="rounded-md bg-primary-foreground/10 px-2.5 py-1 text-primary-foreground hover:bg-primary-foreground/20"
          >
            Sign in
          </Link>
          <Link
            href={appPath('/contribute')}
            className="rounded-md bg-primary-foreground px-2.5 py-1 font-medium text-primary hover:bg-primary-foreground/95"
          >
            Contribute
          </Link>
          <ThemeToggle className="border-primary-foreground/35 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20" />
        </nav>
      </div>
    </header>
  );
}
