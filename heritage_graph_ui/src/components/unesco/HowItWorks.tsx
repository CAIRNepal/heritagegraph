'use client';

/**
 * How a record actually gets into HeritageGraph, in three steps.
 *
 * The entry page said what the platform holds and why, but never what it does.
 * A first-time visitor had no idea whether this was a museum catalogue, a wiki,
 * or someone's dataset.
 *
 * WHY IT LOOKS LIKE THIS
 * Three panels wrapped in the same `CardWeb` used for the seven places, so the
 * steps are strung together by the same living filaments — the process reads as
 * a chain rather than three unrelated boxes, in the visual language the rest of
 * the page already established. Each panel tilts toward the pointer, and
 * pointing at one lights the connections that touch it.
 *
 * Deliberately almost no prose: four words of title and one short line each.
 * The section exists to be understood at a glance, not read.
 *
 * The steps are the real pipeline — contribute, review, publish — not a
 * marketing abstraction of it. Nothing here claims a stage the platform does
 * not actually have.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { IconArrowRight } from '@tabler/icons-react';

import { editorialStagger, revealOnScroll, wideColumn } from '@/lib/design';
import { useReveal } from '@/lib/use-reveal';

import { Eyebrow } from '@/components/editorial';
import { CardWeb } from './CardWeb';
import { TiltCard } from './depth';

const STEPS = ['record', 'check', 'connect'] as const;

export function HowItWorks() {
  const t = useTranslations('unescoEntry.how');
  const reveal = useReveal();

  return (
    <section aria-labelledby="how-heading" className="relative">
      <motion.div {...reveal} variants={revealOnScroll} className={`${wideColumn} mb-8`}>
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <h2
          id="how-heading"
          className="mt-2 font-serif text-3xl leading-tight text-balance sm:text-4xl"
        >
          {t('heading')}
        </h2>
      </motion.div>

      <div className={wideColumn}>
        <CardWeb>
          <motion.ol
            {...reveal}
            variants={editorialStagger}
            className="grid grid-cols-1 gap-x-12 gap-y-10 @xl/main:grid-cols-3"
          >
            {STEPS.map((step, i) => (
              <motion.li key={step} data-web-node variants={revealOnScroll} className="group">
                <TiltCard
                  max={1.4}
                  className="h-full rounded-xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur-[2px] transition-shadow duration-500 group-hover:shadow-xl"
                >
                  <span
                    className="font-mono text-xs tabular-nums text-muted-foreground"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-2 font-serif text-xl leading-tight text-balance">
                    {t(`steps.${step}.title`)}
                  </h3>
                  <p className="mt-2 max-w-[30ch] text-sm leading-relaxed text-muted-foreground">
                    {t(`steps.${step}.desc`)}
                  </p>
                </TiltCard>
              </motion.li>
            ))}
          </motion.ol>
        </CardWeb>

        <motion.div {...reveal} variants={revealOnScroll} className="mt-8">
          <Link
            href="/about"
            className="group inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {t('cta')}
            <IconArrowRight
              className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              aria-hidden="true"
            />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
