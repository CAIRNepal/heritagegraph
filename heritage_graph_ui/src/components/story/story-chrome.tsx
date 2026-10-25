import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The storytelling pages' visual vocabulary: paper, ink, one red, hairline
 * rules, square corners. Colours come from the story tokens in globals.css.
 */

interface ShellProps {
  children: ReactNode;
  className?: string;
}

/** Full-bleed paper page; cancels the site layout's padding. */
export function StoryShell({ children, className }: ShellProps) {
  return (
    <div className={cn('-mx-4 -my-4 flex-1 bg-story-paper text-story-ink md:-mx-6', className)}>
      {children}
    </div>
  );
}

export function StoryContainer({ children, className }: ShellProps) {
  return <div className={cn('mx-auto w-full max-w-[1400px] px-5 md:px-12', className)}>{children}</div>;
}

interface EyebrowProps {
  children: ReactNode;
  ne?: string | null;
  className?: string;
}

export function Eyebrow({ children, ne, className }: EyebrowProps) {
  return (
    <p className={cn('text-[11px] font-semibold uppercase tracking-[0.14em] text-story-accent', className)}>
      {children}
      {ne ? (
        <span lang="ne" className="font-devanagari normal-case tracking-normal">
          {' '}
          / {ne}
        </span>
      ) : null}
    </p>
  );
}

interface ChipProps {
  children: ReactNode;
  filled?: boolean;
}

export function Chip({ children, filled }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border border-story-accent px-2 py-0.5 text-[11px] font-medium',
        filled ? 'bg-story-accent text-story-accent-ink' : 'text-story-accent',
      )}
    >
      {children}
    </span>
  );
}

interface NepaliProps {
  children: ReactNode;
  className?: string;
}

/** A Devanagari line under an English one. */
export function Nepali({ children, className }: NepaliProps) {
  return (
    <p lang="ne" className={cn('font-devanagari font-semibold', className)}>
      {children}
    </p>
  );
}

export function Marker({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block size-3.5 border-2 border-story-accent bg-story-paper', className)} />;
}
