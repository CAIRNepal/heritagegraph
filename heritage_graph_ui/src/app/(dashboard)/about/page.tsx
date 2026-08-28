'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  IconGraph,
  IconDatabase,
  IconUsers,
  IconShield,
  IconCode,
  IconBrandGithub,
  IconMail,
  IconExternalLink,
  IconPlus,
  IconSearch,
  IconArrowRight,
  IconHeart,
  IconFlask,
  IconScale,
  IconLicense,
} from '@tabler/icons-react';

import { ShortcutGrid } from '@/components/dashboard/shortcut-grid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardLinkItem } from '@/config/dashboard-links';
import {
  fadeInUp,
  heroForeground,
  heroForegroundMuted,
  heroGradient,
  scaleIn,
  revealProps,
  staggerContainer,
  surfaceCard,
} from '@/lib/design';
import { cn } from '@/lib/utils';

const REPOSITORY_URL = 'https://github.com/CAIRNepal/heritagegraph';

const coreFeatures: DashboardLinkItem[] = [
  {
    titleKey: 'knowledgeGraph.title',
    descKey: 'knowledgeGraph.desc',
    icon: IconGraph,
    href: '/graphview',
  },
  {
    titleKey: 'linkedOpenData.title',
    descKey: 'linkedOpenData.desc',
    icon: IconDatabase,
    href: '/knowledge/entity',
  },
  {
    titleKey: 'communityCuration.title',
    descKey: 'communityCuration.desc',
    icon: IconUsers,
    href: '/community/contributors',
  },
  {
    // Links to the public Methods page rather than the login-gated review
    // queue: the review model must be inspectable without an account.
    titleKey: 'epistemicReview.title',
    descKey: 'epistemicReview.desc',
    icon: IconShield,
    href: '/methods',
  },
];

/** Standards and vocabularies a reviewer needs named explicitly. */
const standards = [
  { key: 'cidoc', icon: IconDatabase },
  { key: 'crminf', icon: IconFlask },
  { key: 'linkml', icon: IconCode },
  { key: 'shacl', icon: IconShield },
  { key: 'skos', icon: IconDatabase },
  { key: 'voidDcat', icon: IconLicense },
];

function SectionHeading({ prefix, highlight }: { prefix: string; highlight: string }) {
  return (
    <h2 className="mb-6 font-serif text-2xl font-semibold text-foreground">
      {prefix} <span className="text-primary">{highlight}</span>
    </h2>
  );
}

export default function AboutPage() {
  const t = useTranslations('about');
  const reduceMotion = useReducedMotion();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 pb-8">
      {/* Hero */}
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        animate="show"
        variants={staggerContainer}
        className={cn('relative overflow-hidden', surfaceCard, 'p-8 md:p-10')}
      >
        <div className={cn('absolute inset-0', heroGradient)} />

        <motion.div
          variants={fadeInUp}
          className="relative z-10 flex flex-col items-center gap-8 md:flex-row md:items-start"
        >
          <div className="min-w-0 flex-1 space-y-4 text-center md:text-left">
            <h1
              className={cn(
                'font-serif text-3xl font-bold leading-tight md:text-4xl lg:text-5xl',
                heroForeground,
              )}
            >
              {t('hero.titlePrefix')}{' '}
              <span className={heroForegroundMuted}>{t('hero.titleHighlight')}</span>
            </h1>
            <p
              className={cn(
                'mx-auto max-w-2xl text-base leading-relaxed md:mx-0 md:text-lg',
                heroForegroundMuted,
              )}
            >
              {t('hero.description')}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-1 md:justify-start">
              <Button
                size="lg"
                asChild
                className="rounded-full bg-hero-foreground font-semibold text-hero-from shadow-sm hover:bg-hero-foreground/90"
              >
                <Link href="/contribute">
                  <IconPlus className="mr-2 size-4" />
                  {t('hero.startContributing')}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="rounded-full border-hero-foreground/40 bg-hero-foreground/10 font-semibold text-hero-foreground hover:bg-hero-foreground/20 hover:text-hero-foreground"
              >
                <Link href="/methods">
                  <IconFlask className="mr-2 size-4" />
                  {t('hero.methods')}
                  <IconArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <motion.div variants={scaleIn} className="shrink-0">
            <div className="flex size-28 items-center justify-center rounded-2xl border border-hero-foreground/30 bg-hero-foreground/15 md:size-32">
              <Image
                src="/logo1.svg"
                alt="HeritageGraph"
                width={72}
                height={72}
                className="size-16 md:size-20"
              />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Mission */}
      <motion.div
        {...revealProps(reduceMotion)}
        variants={fadeInUp}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <IconHeart className="size-5 text-primary" aria-hidden />
              {t('mission.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            <p>{t('mission.paragraph1')}</p>
            <p>
              <strong className="text-foreground">{t('mission.appName')}</strong>{' '}
              {t('mission.paragraph2')}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Core features */}
      <motion.section
        {...revealProps(reduceMotion)}
        variants={staggerContainer}
      >
        <motion.div variants={fadeInUp}>
          <SectionHeading
            prefix={t('sections.coreFeatures.prefix')}
            highlight={t('sections.coreFeatures.highlight')}
          />
        </motion.div>
        <ShortcutGrid
          items={coreFeatures}
          variant="detailed"
          namespace="about.features"
          columns={{ base: 'grid-cols-1', md: 'md:grid-cols-2' }}
        />
      </motion.section>

      {/* Data, provenance and reuse — the section a reviewer reads first. */}
      <motion.section
        {...revealProps(reduceMotion)}
        variants={fadeInUp}
      >
        <SectionHeading
          prefix={t('sections.data.prefix')}
          highlight={t('sections.data.highlight')}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconScale className="size-5 text-primary" aria-hidden />
              {t('data.title')}
            </CardTitle>
            <CardDescription>{t('data.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {['provenance', 'access', 'licensing', 'identifiers'].map((key) => (
                <div
                  key={key}
                  className="rounded-lg border border-border/60 bg-muted/30 p-4"
                >
                  <dt className="text-sm font-medium text-foreground">
                    {t(`data.${key}.term`)}
                  </dt>
                  <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t(`data.${key}.definition`)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/methods">
                  <IconFlask className="mr-2 size-4" />
                  {t('data.methodsCta')}
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`${REPOSITORY_URL}/blob/main/LICENSE-DATA`} target="_blank" rel="noopener noreferrer">
                  <IconLicense className="mr-2 size-4" />
                  {t('data.licenseCta')}
                  <IconExternalLink className="ml-2 size-3" aria-hidden />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* Standards */}
      <motion.section
        {...revealProps(reduceMotion)}
        variants={fadeInUp}
      >
        <SectionHeading
          prefix={t('sections.standards.prefix')}
          highlight={t('sections.standards.highlight')}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconCode className="size-5 text-primary" aria-hidden />
              {t('standards.title')}
            </CardTitle>
            <CardDescription>{t('standards.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {standards.map(({ key, icon: Icon }) => (
                <div
                  key={key}
                  className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/25 p-3"
                >
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <div className="text-sm font-medium">{t(`standards.${key}.name`)}</div>
                    <div className="text-xs text-muted-foreground">
                      {t(`standards.${key}.role`)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* CAIR-Nepal */}
      <motion.div
        {...revealProps(reduceMotion)}
        variants={fadeInUp}
      >
        <Card className="overflow-hidden">
          <div className="flex flex-col md:flex-row">
            <div className="flex items-center justify-center border-b border-border bg-muted/30 p-8 md:w-2/5 md:border-b-0 md:border-r">
              <div className="text-center">
                <Image
                  src="/cair-logo/fulllogo_nobuffer.png"
                  alt="CAIR-Nepal"
                  width={180}
                  height={72}
                  className="mx-auto h-auto w-36 opacity-90 dark:invert"
                  sizes="144px"
                />
                <p className="mt-3 text-sm text-muted-foreground">{t('cair.subtitle')}</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-4 p-8">
              <h3 className="font-serif text-xl font-semibold">{t('cair.title')}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                {t('cair.description')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="https://www.cair-nepal.org/" target="_blank" rel="noopener noreferrer">
                    <IconExternalLink className="mr-2 size-4" />
                    {t('cair.website')}
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://github.com/CAIRNepal" target="_blank" rel="noopener noreferrer">
                    <IconBrandGithub className="mr-2 size-4" />
                    GitHub
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="mailto:info@cair-nepal.org">
                    <IconMail className="mr-2 size-4" />
                    {t('cair.contact')}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* CTA */}
      <motion.div
        {...revealProps(reduceMotion)}
        variants={fadeInUp}
      >
        <Card className={cn('relative overflow-hidden', surfaceCard)}>
          <div className={cn('absolute inset-0', heroGradient)} />
          <CardContent className="relative z-10 p-8 text-center">
            <h2 className={cn('font-serif text-2xl font-bold md:text-3xl', heroForeground)}>
              {t('cta.title')}
            </h2>
            <p className={cn('mx-auto mt-3 max-w-2xl', heroForegroundMuted)}>
              {t('cta.description')}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                asChild
                className="rounded-full bg-hero-foreground font-semibold text-hero-from hover:bg-hero-foreground/90"
              >
                <Link href="/contribute">
                  <IconPlus className="mr-2 size-4" />
                  {t('cta.contribute')}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="rounded-full border-hero-foreground/40 bg-hero-foreground/10 text-hero-foreground hover:bg-hero-foreground/20 hover:text-hero-foreground"
              >
                <Link href="/knowledge/entity">
                  <IconSearch className="mr-2 size-4" />
                  {t('cta.browse')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Open source & citation */}
      <motion.div
        {...revealProps(reduceMotion)}
        variants={fadeInUp}
      >
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row">
            <div className="flex items-center gap-4">
              <IconBrandGithub className="size-8 text-muted-foreground" aria-hidden />
              <div>
                <h3 className="font-semibold">{t('openSource.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('openSource.description')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
                  <IconBrandGithub className="mr-2 size-4" />
                  {t('openSource.viewSource')}
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={`${REPOSITORY_URL}/blob/main/CITATION.cff`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('openSource.howToCite')}
                  <IconExternalLink className="ml-2 size-3" aria-hidden />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
