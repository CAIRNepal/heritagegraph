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

/* ══════════════════════════════════════════════════════════════════════════
   Editorial motion — added for the museum-style entry experience.

   The direction is "slow, weighted, purposeful; reveal rather than decorate".
   That rules out springs: a spring overshoots and settles, which reads as
   bounce. These use a custom cubic-bézier with a long tail instead, so motion
   decelerates into place and stops.

   Every variant below is inert when the user prefers reduced motion, provided
   the call site passes `motionInitialWhenEnabled(reduceMotion)` as `initial`.
   ══════════════════════════════════════════════════════════════════════════ */

/** Weighted deceleration curve. Slow start, long settle, no overshoot. */
export const editorialEase = [0.16, 1, 0.3, 1] as const;

/**
 * Scroll-triggered reveal for editorial sections.
 *
 * Pair with `whileInView="show"` and `viewport={{ once: true, amount: 0.25 }}`
 * so a section reveals once when a quarter of it is on screen and never
 * re-animates as the reader scrolls back.
 */
export const revealOnScroll = {
  hidden: { opacity: 0, y: 32 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: editorialEase },
  },
};

/**
 * Image reveal. Fades opacity only — deliberately no transform and no scale.
 *
 * A transform on a large photograph is the usual cause of layout shift on
 * image load, and the landing page has a CLS budget of zero. The container
 * must reserve its aspect ratio before this runs.
 */
export const imageReveal = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.9, ease: editorialEase },
  },
};

/**
 * Slower, wider-spaced stagger for editorial rows — the dashboard's
 * `staggerContainer` (0.08s) is too quick to read as deliberate at this scale.
 */
export const editorialStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

/** Viewport config for `whileInView`. Reveal once, at a quarter visible. */
export const revealViewport = { once: true, amount: 0.25 } as const;

/* ── Editorial surfaces ─────────────────────────────────────────────────── */

/**
 * Full-bleed section on the page ground. Used to alternate bands down the
 * landing page the way a Newar façade alternates brick courses and timber.
 */
export const editorialSection = 'w-full py-16 md:py-24';

/** Reading column. Caps running text near 68 characters. */
export const readingColumn = 'mx-auto w-full max-w-[68ch] px-5 sm:px-6';

/** Wide content column for photography and grids. */
export const wideColumn = 'mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8';

/**
 * Photograph frame. Reserves the aspect ratio before the image loads so
 * nothing shifts, and clips the image to the surface radius.
 */
export const photoFrame =
  'relative overflow-hidden rounded-xl bg-muted';

/**
 * Scrim laid under text that sits on a photograph. Uses a neutral black ramp
 * rather than a token because it darkens *the photograph*, not a themed
 * surface — it must behave identically in both themes.
 */
export const photoScrim =
  'absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent';

/**
 * Props for a scroll-revealed element, correct under reduced motion.
 *
 * WHY THIS EXISTS — the naive spelling has a real bug:
 *
 *     initial={motionInitialWhenEnabled(reduceMotion)}
 *     whileInView="show"
 *
 * `useReducedMotion()` returns null during SSR, so the server renders the
 * `hidden` variant's styles inline (`opacity: 0`). On a client that prefers
 * reduced motion, `initial` becomes `false`, so Framer does not animate — and
 * with `whileInView` gated behind an IntersectionObserver that may never be
 * satisfied for that element, nothing ever clears the inline `opacity: 0`.
 * The section stays permanently invisible for exactly the users who asked for
 * less motion.
 *
 * So when reduced motion is preferred we drop the scroll trigger entirely and
 * assert the shown state with `animate`. Content visibility must never depend
 * on an animation having run.
 */
export function revealProps(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return { initial: false as const, animate: 'show' };
  }
  return {
    initial: 'hidden',
    whileInView: 'show',
    viewport: revealViewport,
  };
}
