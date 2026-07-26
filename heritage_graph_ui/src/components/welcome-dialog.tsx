'use client';

/**
 * First-visit onboarding. Shows once (localStorage-gated) to orient new visitors:
 * search (⌘K), explore the museum, and contribute. Dismissible; never nags.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  IconBuildingMonument,
  IconSearch,
  IconPlus,
  IconWorld,
} from '@tabler/icons-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'hg_welcome_seen_v1';

const STEPS = [
  {
    icon: IconBuildingMonument,
    title: 'Explore the Heritage Museum',
    body: 'Browse the living knowledge graph as an interactive graph, map, timeline, or illustrated story.',
    href: '/heritage-museum',
    cta: 'Open Museum',
  },
  {
    icon: IconWorld,
    title: 'See it on the Atlas',
    body: 'Discover heritage entities across place and time on an interactive globe.',
    href: '/atlas',
    cta: 'Open Atlas',
  },
  {
    icon: IconPlus,
    title: 'Contribute your knowledge',
    body: 'Add monuments, deities, festivals, rituals and more. Every contribution is reviewed before it is published.',
    href: '/contribute',
    cta: 'Contribute',
  },
];

export function WelcomeDialog() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      /* localStorage unavailable — skip onboarding */
    }
  }, []);

  const dismiss = React.useCallback((value: boolean) => {
    setOpen(value);
    if (!value) {
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={dismiss}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to HeritageGraph 🏛️</DialogTitle>
          <DialogDescription>
            A community knowledge graph of cultural heritage. Here is how to get started —
            press{' '}
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">⌘K</kbd> any
            time to search.
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-2 flex flex-col gap-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <li
                key={s.href}
                className="flex items-start gap-3 rounded-lg border border-border/60 p-3"
              >
                <span className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <p className="font-medium leading-tight">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
                <Link href={s.href} onClick={() => dismiss(false)}>
                  <Button size="sm" variant="outline">
                    {s.cta}
                  </Button>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <IconSearch className="h-3.5 w-3.5" /> Tip: ⌘K opens search anywhere
          </span>
          <Button onClick={() => dismiss(false)}>Get started</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
