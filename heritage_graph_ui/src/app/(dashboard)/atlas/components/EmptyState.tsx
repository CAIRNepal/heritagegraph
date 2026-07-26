'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Globe2, Play, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useAtlasStore } from '../hooks/use-atlas-store';
import { useAtlasUiStore } from '../hooks/use-atlas-ui-store';
import { ATLAS_GLASS } from '../lib/atlas-format';

interface EmptyStateProps {
  onPlayJourney: () => void;
}

/** First-visit onboarding: an invitation over the slowly turning Earth. */
export function EmptyState({ onPlayJourney }: EmptyStateProps) {
  const onboardingDismissed = useAtlasUiStore((s) => s.onboardingDismissed);
  const dismissOnboarding = useAtlasUiStore((s) => s.dismissOnboarding);
  const setSpotlightOpen = useAtlasUiStore((s) => s.setSpotlightOpen);
  const storyActive = useAtlasUiStore((s) => s.story.active);
  const selectedId = useAtlasStore((s) => s.selectedId);

  const show = !onboardingDismissed && !selectedId && !storyActive;

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.5 }}
            className={cn(
              ATLAS_GLASS,
              'pointer-events-auto mx-4 flex max-w-md flex-col items-center px-8 py-8 text-center',
            )}
          >
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-accent/25 text-primary">
              <Globe2 className="h-6 w-6" strokeWidth={1.25} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight">
              Explore Humanity&apos;s Heritage
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Travel through centuries of temples, festivals, dynasties and living
              traditions — connected by a knowledge graph, mapped on a living Earth.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                className="h-9 rounded-xl bg-gradient-to-r from-primary to-accent px-4 text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90"
                onClick={onPlayJourney}
              >
                <Play className="mr-1.5 h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
                Play the journey
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl px-4"
                onClick={() => {
                  dismissOnboarding();
                  setSpotlightOpen(true);
                }}
              >
                <Search className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
                Search
              </Button>
              <button
                type="button"
                className="px-2 text-[12px] text-muted-foreground underline-offset-4 hover:underline"
                onClick={dismissOnboarding}
              >
                Just explore
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
