/**
 * Shared design constants for HeritageGraph dashboard pages.
 * Matches the landing page's glassmorphic + gradient design system.
 *
 * Import from '@/lib/design' instead of re-declaring in every page file.
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

/* ── card base ── one card language, token-based (no glassmorphism, no
   hardcoded colors). Subtle elevation; raise on hover at the call site. ── */
export const glassCard =
  'bg-card text-card-foreground border border-border rounded-xl shadow-xs';

/* ── hero header treatment ── a single restrained brand gradient (one hue
   family) instead of a multi-stop rainbow; white foreground stays legible. ── */
export const heroGradient =
  'bg-gradient-to-br from-primary to-accent rounded-xl';
