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

/* ── glassmorphic card base ── */
export const glassCard =
  'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg';

/* ── gradient hero overlay used on page header sections ── */
export const heroGradient =
  'bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl';
