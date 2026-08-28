'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import {
  IconArrowRight,
  IconCircleCheck,
  IconLicense,
  IconTopologyStar3,
  IconWorldSearch,
} from '@tabler/icons-react';

import { editorialStagger, revealOnScroll, revealProps, wideColumn } from '@/lib/design';
import { useReveal } from '@/lib/use-reveal';
import { cn } from '@/lib/utils';

import { AmbientWash } from './depth';
import { Eyebrow } from './entry-sections';

/**
 * What HeritageGraph actually is.
 *
 * The entry page opened straight onto seven monument zones, which showed a
 * visitor the heritage but never told them what platform they had landed on or
 * why its records should be trusted. This sits directly under the photograph,
 * before the zones, and answers that in a few lines — then hands off to /about
 * for anyone who wants the full account.
 */

const PILLARS = [
  { key: 'graph', Icon: IconTopologyStar3 },
  { key: 'sourced', Icon: IconCircleCheck },
  { key: 'reviewed', Icon: IconWorldSearch },
  { key: 'open', Icon: IconLicense },
] as const;

export function PlatformIntro({ className }: { className?: string }) {
  const t = useTranslations('unescoEntry.platform');
  const reduceMotion = useReducedMotion();
  const reveal = useReveal();

  return (
    <section
      aria-labelledby="platform-heading"
      className={cn('relative isolate', className)}
    >
      <AmbientWash />
      <motion.div
        variants={editorialStagger}
        {...reveal}
        className={wideColumn}
      >
        <motion.div variants={revealOnScroll} className="max-w-3xl">
          <Eyebrow>{t('eyebrow')}</Eyebrow>
          <h2
            id="platform-heading"
            className="mt-2 font-serif text-3xl leading-tight text-balance sm:text-4xl"
          >
            {t('title')}
          </h2>
          <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('lede')}
          </p>
        </motion.div>

        <motion.ul
          variants={revealOnScroll}
          className="mt-10 grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4"
        >
          {PILLARS.map(({ key, Icon }) => (
            <li key={key} className="flex flex-col gap-2 border-t border-border pt-4">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-serif text-lg leading-snug text-balance">
                {t(`pillars.${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`pillars.${key}.desc`)}
              </p>
            </li>
          ))}
        </motion.ul>

        <motion.div variants={revealOnScroll} className="mt-9">
          <Link
            href="/about"
            className="group inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {t('more')}
            <IconArrowRight
              className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              aria-hidden="true"
            />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
