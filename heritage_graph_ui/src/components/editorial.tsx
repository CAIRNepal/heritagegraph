/**
 * Shared editorial primitives.
 *
 * These started inside the entry page's own section file. They moved here when
 * the reference pages had to read as the same publication — importing them from
 * `components/unesco/entry-sections` would have pulled that module's UNESCO
 * ground-truth and museum-link dependencies into every page that wanted a
 * label.
 */
import { cn } from '@/lib/utils';

/** A small mono label above a heading. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * The continuous tinted ground the entry page opens on.
 *
 * Sits behind a group of sections rather than one, because the seam it exists
 * to remove is the strip of untinted page between two separately-washed
 * sections. Soft at both ends, so there is no edge anywhere to see.
 */
export function OpeningGround({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,transparent_0%,color-mix(in_oklab,var(--primary)_5%,transparent)_30%,color-mix(in_oklab,var(--primary)_5%,transparent)_74%,transparent_100%)]',
        className,
      )}
    />
  );
}
