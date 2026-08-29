'use client';

/**
 * The top bar, shared by the public shell and the workspace shell.
 *
 * WHY A TOP BAR AT ALL
 * The entry page opened inside the workspace sidebar — a reader arriving at the
 * front door was handed Contributions Queue, Activity Log and Browse by type
 * before they knew what the platform was. Those are a contributor's tools. The
 * front door needs the few destinations a visitor actually wants, and nothing
 * else.
 *
 * WHY ONE COMPONENT FOR BOTH SHELLS
 * So that moving between them does not feel like changing site. The bar is
 * identical everywhere; the only difference is that the workspace shell also
 * renders the sidebar trigger, because that shell has a sidebar to toggle.
 *
 * Reference material (About, Methods, Team, Contributors, Organizations) sits
 * under one menu rather than five top-level links: it is what a reader consults
 * once, not what they navigate by.
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookOpen, ChevronDown, Menu } from 'lucide-react';

import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/** The destinations a visitor navigates by. */
const PRIMARY = [
  { key: 'heritageMuseum', href: '/heritage-museum' },
  { key: 'heritageAtlas', href: '/atlas' },
  { key: 'contribute', href: '/contribute' },
  { key: 'dashboard', href: '/dashboard' },
] as const;

/**
 * Reference material, consulted rather than navigated.
 *
 * The menu is labelled "About" and its first item is the About page. That
 * repetition is deliberate: the label a visitor looks for when they want to
 * know who is behind this is "About", not "Reference".
 */
const REFERENCE = [
  { key: 'about', href: '/about' },
  { key: 'methods', href: '/methods' },
  { key: 'team', href: '/team' },
  { key: 'contributors', href: '/community/contributors' },
  { key: 'organizations', href: '/community/organizations' },
] as const;

/** True when `href` is the current page or an ancestor of it. */
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({ withSidebarTrigger = false }: { withSidebarTrigger?: boolean }) {
  const t = useTranslations('nav');
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);

  const referenceActive = REFERENCE.some((r) => isActive(pathname, r.href));

  const linkCls = (active: boolean) =>
    cn(
      'relative rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      // The current page is marked with a rule beneath it, not a heavier
      // weight: a weight change makes the whole row jitter as you move between
      // pages, because the labels reflow.
      'after:absolute after:inset-x-2 after:-bottom-px after:h-px after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 motion-reduce:after:transition-none',
      active
        ? 'text-foreground after:scale-x-100'
        : 'text-muted-foreground hover:text-foreground hover:after:scale-x-100 hover:after:bg-border',
    );

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {withSidebarTrigger ? (
        <>
          <SidebarTrigger />
          <div className="h-5 w-px bg-border" aria-hidden="true" />
        </>
      ) : null}

      {/* Wordmark. Never truncates — it is the way back to the front door. */}
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary shadow-sm">
          <BookOpen className="size-3.5 text-primary-foreground" aria-hidden="true" />
        </span>
        {/* The same two-tone compound the hero wordmark and the page titles
            use — bold first half, light second. A single-weight label was the
            main reason the bar felt unrelated to the page under it. */}
        <span className="font-serif text-[0.95rem] leading-none tracking-[-0.01em] text-foreground">
          <span className="font-bold">Heritage</span>
          <span className="font-light text-muted-foreground">Graph</span>
        </span>
      </Link>

      {/* Desktop nav. Keyed to the header's own container, not the viewport:
          in the workspace shell this bar sits inside a 288px sidebar inset, so
          a viewport-keyed breakpoint shows links the bar has no room for. */}
      <nav
        aria-label={t('navigation')}
        className="ml-3 hidden items-center gap-0.5 @[52rem]/header:flex"
      >
        {PRIMARY.map(({ key, href }) => (
          <Link key={href} href={href} className={linkCls(isActive(pathname, href))}>
            {t(key)}
          </Link>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(linkCls(referenceActive), 'inline-flex items-center gap-1')}
          >
            {t('about')}
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {REFERENCE.map(({ key, href }) => (
              <DropdownMenuItem key={href} asChild>
                <Link href={href}>{t(key)}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* Below that width the same links live in a sheet. A nav that silently
          disappears on a narrow screen is worse than no nav. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label={t('navigation')}
          className="ml-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring @[52rem]/header:hidden"
        >
          <Menu className="size-4.5" aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="border-b border-border px-5 py-4 font-serif text-base">
            {t('navigation')}
          </SheetTitle>
          <nav className="flex flex-col gap-1 p-3">
            {PRIMARY.map(({ key, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-md px-3 py-2 text-sm transition-colors',
                  isActive(pathname, href)
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {t(key)}
              </Link>
            ))}
            <p className="mt-4 px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
              {t('about')}
            </p>
            {REFERENCE.map(({ key, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-md px-3 py-2 text-sm transition-colors',
                  isActive(pathname, href)
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {t(key)}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
