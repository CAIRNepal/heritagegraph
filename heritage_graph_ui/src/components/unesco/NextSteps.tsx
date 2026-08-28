'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { IconArrowUpRight, IconChartDots3, IconPencilPlus } from '@tabler/icons-react';

import { revealOnScroll, wideColumn } from '@/lib/design';
import { useReveal } from '@/lib/use-reveal';

import { TiltCard } from './depth';

/**
 * Where a reader goes after the seven zones.
 *
 * Two doors, not a row of buttons: one into the record as it stands, one into
 * adding to it. They are given the same weight because for this project they
 * matter equally — a heritage graph nobody contributes to stops being current.
 */
export function NextSteps() {
  const t = useTranslations('unescoEntry');
  const reveal = useReveal();

  const doors = [
    { key: 'nextBrowse', href: '/dashboard', Icon: IconChartDots3 },
    { key: 'nextContribute', href: '/contribute', Icon: IconPencilPlus },
  ] as const;

  return (
    <motion.section
      {...reveal}
      variants={revealOnScroll}
      aria-labelledby="next-heading"
      className={wideColumn}
    >
      <h2 id="next-heading" className="sr-only">
        {t('nextTitle')}
      </h2>
      <div className="grid gap-5 sm:grid-cols-2">
        {doors.map(({ key, href, Icon }) => (
          <TiltCard key={key} max={1.4}>
            <Link
              href={href}
              className="group flex h-full flex-col justify-between gap-6 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow duration-500 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-8"
            >
              <div>
                <Icon className="size-6 text-primary" aria-hidden="true" />
                <h3 className="mt-4 font-serif text-2xl leading-tight text-balance">
                  {t(`${key}.title`)}
                </h3>
                <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
                  {t(`${key}.desc`)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                {t(`${key}.cta`)}
                <IconArrowUpRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
                  aria-hidden="true"
                />
              </span>
            </Link>
          </TiltCard>
        ))}
      </div>
    </motion.section>
  );
}
