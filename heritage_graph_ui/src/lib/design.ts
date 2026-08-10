/**
 * Shared design constants for HeritageGraph dashboard pages.
 *
 * Import from '@/lib/design' instead of re-declaring in every page file.
 * Colours come from the tokens in globals.css — never write a literal palette
 * class (`text-blue-700`, `bg-blue-50`) in a component.
 */

/* ── framer-motion animation variants ── */
export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

export const scaleIn = {
  hidden: { scale: 0.9, opacity: 0 },
  show: { scale: 1, opacity: 1, transition: { duration: 0.4 } },
};

/** Use with Framer Motion: disable enter/scroll animations when the user prefers reduced motion. */
export function motionInitialWhenEnabled(reduceMotion: boolean | null): false | 'hidden' {
  if (reduceMotion) return false;
  return 'hidden';
}

/* ── card base ── one card language, token-based. Subtle elevation; raise on
   hover at the call site. ── */
export const surfaceCard =
  'bg-card text-card-foreground border border-border rounded-xl shadow-xs';

/**
 * @deprecated Kept only so older imports keep compiling. The cards are not
 * glassmorphic — use `surfaceCard`.
 */
export const glassCard = surfaceCard;

/* ── hero header treatment ──
   Uses the dedicated --hero-* tokens rather than --primary/--accent. In dark
   mode --primary is a light blue (#5a9bff) and white text on it measures
   2.8:1, below the WCAG AA 3:1 large-text floor. The hero tokens are dark in
   both themes, so `heroForeground` stays legible either way. ── */
export const heroGradient =
  'bg-gradient-to-br from-hero-from to-hero-to rounded-xl';

/** Primary text on a hero surface. */
export const heroForeground = 'text-hero-foreground';

/** Secondary text on a hero surface — still ≥ 4.5:1 against both hero stops. */
export const heroForegroundMuted = 'text-hero-foreground/90';
