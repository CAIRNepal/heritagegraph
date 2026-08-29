'use client';

/**
 * Chrome shared by the public shell and the workspace shell.
 *
 * Both shells render the same bar and the same footer, from here, so moving
 * between them changes the page and nothing else. When these lived inline in
 * the workspace layout, the public entry page could only match them by
 * duplication — and duplicated chrome drifts.
 */

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Github, Mail, ExternalLink } from 'lucide-react';

import AuthButtons from '@/components/AuthButtons';
import { CommandMenuTrigger } from '@/components/command-menu';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserProgressBadge } from '@/components/progression-widgets';

const NotificationBell = dynamic(
  () => import('@/components/notification-bell').then((mod) => mod.NotificationBell),
  { ssr: false },
);

/**
 * The controls at the right of the bar.
 *
 * Breakpoints are keyed to `@container/header` rather than the viewport: in the
 * workspace shell the bar sits inside a 288px sidebar inset, so at a 900px
 * viewport it is only 597px wide, and viewport-keyed breakpoints let controls
 * through that the bar has no room for. None of them can shrink.
 */
export function HeaderControls() {
  const { status } = useSession();
  const authed = status === 'authenticated';
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2 @[30rem]/header:gap-3">
      <CommandMenuTrigger />
      {authed ? <UserProgressBadge /> : null}
      {authed ? <NotificationBell /> : null}
      <LanguageSwitcher />
      <AuthButtons />
      <ThemeToggle />
    </div>
  );
}

export function SiteFooter() {
  const t = useTranslations('common');
  return (
    <footer className="border-t border-border bg-card/40 px-4 py-2 backdrop-blur-sm md:px-6">
      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <Image
            src="/cair-logo/fulllogo_nobuffer.png"
            alt="CAIR-Nepal"
            width={1280}
            height={314}
            className="opacity-70"
            // next/image warns when CSS overrides one dimension but not the
            // other; stating both keeps the intrinsic aspect ratio explicit.
            style={{ height: '1.25rem', width: 'auto' }}
            sizes="80px"
          />
          <span className="hidden sm:inline">
            {t('copyright', { year: new Date().getFullYear() })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href="https://github.com/CAIRNepal/heritagegraph"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="rounded p-1 transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            <Github className="h-3.5 w-3.5" />
          </a>
          <a
            href="mailto:info@cair-nepal.org"
            aria-label="Email"
            className="rounded p-1 transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://www.cair-nepal.org/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="CAIR-Nepal"
            className="rounded p-1 transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}

/** The bar itself, so both shells share one set of paddings and borders. */
export function SiteBar({ children }: { children: React.ReactNode }) {
  return (
    <header
      className="@container/header sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-xl md:px-6"
      role="banner"
    >
      {children}
    </header>
  );
}
