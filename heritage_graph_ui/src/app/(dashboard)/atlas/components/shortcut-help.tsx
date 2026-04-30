'use client';

import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { useAtlasStore } from '../hooks/use-atlas-store';

function useAtlasTranslations() {
  return useTranslations('Atlas') as unknown as (key: string) => string;
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function ShortcutHelpOverlay() {
  const t = useAtlasTranslations();
  const open = useAtlasStore((s) => s.showShortcutHelp);
  const toggleShortcutHelp = useAtlasStore((s) => s.toggleShortcutHelp);

  const rows: { keys: string; label: string }[] = [
    { keys: 'F', label: 'skFullscreen' },
    { keys: 'S', label: 'skPanel' },
    { keys: 'Space', label: 'skTimelinePlay' },
    { keys: 'Z / X', label: 'skZoom' },
    { keys: '0', label: 'skReset' },
    { keys: '↑ / ↓', label: 'skNav' },
    { keys: 'J / L', label: 'skCityCycle' },
    { keys: '⌘K', label: 'skPalette' },
    { keys: 'P / ⇧P', label: 'skFxCycle' },
    { keys: 'B', label: 'skFlirPolarity' },
    { keys: '⇧0', label: 'skShiftReset' },
    { keys: '1 – 6', label: 'skViews' },
    { keys: '7', label: 'skDismissMax' },
    { keys: '[ ]', label: 'skReliability' },
    { keys: ', .', label: 'skConfidence' },
    { keys: 'G', label: 'skSearchFocus' },
    { keys: 'T', label: 'skDiscTransparent' },
    { keys: 'Esc', label: 'skEsc' },
    { keys: '?', label: 'skHelp' },
    { keys: 'M', label: 'skMute' },
    { keys: 'Home / End', label: 'skTimelineJump' },
  ];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal
          aria-label={t('shortcutTitle')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
          onClick={() => toggleShortcutHelp()}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full max-w-md rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{t('shortcutTitle')}</h2>
              <Button variant="ghost" size="icon" type="button" onClick={() => toggleShortcutHelp()}>
                <IconX className="h-4 w-4" />
                <span className="sr-only">{t('shortcutClose')}</span>
              </Button>
            </div>
            <ul className="max-h-[65vh] space-y-2 overflow-auto p-4 text-sm">
              {rows.map((row) => (
                <li key={row.label} className="flex items-start gap-3">
                  <span className="min-w-[5.5rem] shrink-0 text-xs text-muted-foreground">
                    <Kbd>{row.keys}</Kbd>
                  </span>
                  <span className="leading-snug">{t(row.label)}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
