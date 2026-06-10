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
  IconBuildingCommunity,
  IconCode,
  IconBrandGithub,
  IconMail,
  IconExternalLink,
  IconTrophy,
  IconPlus,
  IconBooks,
  IconSearch,
  IconSparkles,
  IconArrowRight,
  IconHeart,
  IconMapPin,
  IconCalendarEvent,
  IconFlame,
  IconFileDescription,
  IconBrandPython,
  IconBrandReact,
  IconApi,
  IconWorld,
} from '@tabler/icons-react';

import { ShortcutGrid } from '@/components/dashboard/shortcut-grid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardLinkItem } from '@/config/dashboard-links';
import {
  fadeInUp,
  glassCard,
  heroGradient,
  motionInitialWhenEnabled,
  scaleIn,
  staggerContainer,
} from '@/lib/design';
import { cn } from '@/lib/utils';

const coreFeatures: DashboardLinkItem[] = [
  {
    title: 'Knowledge Graph',
    desc: 'Interactive ontology-driven graph visualization powered by CIDOC-CRM.',
    icon: IconGraph,
    href: '/graphview',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    title: 'Linked Open Data',
    desc: 'Machine-readable heritage records for interoperability across archives.',
    icon: IconDatabase,
    href: '/knowledge/entity',
    gradient: 'from-blue-500 to-cyan-600',
  },
  {
    title: 'Community Curation',
    desc: 'Contributions from scholars, institutions, and community members with peer review.',
    icon: IconUsers,
    href: '/community/contributors',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    title: 'Epistemic Review',
    desc: 'Three-persona review: community reviewers, domain experts, and expert curators.',
    icon: IconShield,
    href: '/curation/review',
    gradient: 'from-amber-500 to-orange-600',
  },
];

const knowledgeDomains: DashboardLinkItem[] = [
  { title: 'Cultural Entities', icon: IconBuildingCommunity, href: '/knowledge/entity', gradient: 'from-blue-600 to-cyan-500' },
  { title: 'Historical Persons', icon: IconUsers, href: '/knowledge/person', gradient: 'from-violet-500 to-purple-600' },
  { title: 'Heritage Locations', icon: IconMapPin, href: '/knowledge/location', gradient: 'from-emerald-500 to-teal-600' },
  { title: 'Cultural Events', icon: IconCalendarEvent, href: '/knowledge/event', gradient: 'from-amber-500 to-orange-500' },
  { title: 'Traditions & Practices', icon: IconFlame, href: '/knowledge/tradition', gradient: 'from-rose-500 to-pink-600' },
  { title: 'Documentary Sources', icon: IconFileDescription, href: '/knowledge/source', gradient: 'from-slate-500 to-gray-600' },
];

const techStack = [
  { name: 'Django REST Framework', description: 'Python backend API', icon: IconBrandPython },
  { name: 'Next.js 15', description: 'React frontend with App Router', icon: IconBrandReact },
  { name: 'CIDOC-CRM', description: 'Heritage ontology standard', icon: IconDatabase },
  { name: 'Linked Open Data', description: 'RDF / SPARQL publication', icon: IconWorld },
  { name: 'PostgreSQL', description: 'Relational database', icon: IconDatabase },
  { name: 'REST APIs', description: 'Flexible programmatic access', icon: IconApi },
];

const progressionTracks = [
  { emoji: '🏺', title: 'Curation', description: 'Submit and classify heritage artifacts' },
  { emoji: '📜', title: 'Annotation', description: 'Add provenance and scholarly context' },
  { emoji: '🔍', title: 'Verification', description: 'Peer-review and authenticate records' },
  { emoji: '🖼️', title: 'Exhibition', description: 'Curate public collections' },
];

const tierSummary = [
  { icon: '🕯️', name: 'Apprentice' },
  { icon: '📚', name: 'Scholar' },
  { icon: '🏛️', name: 'Curator' },
  { icon: '📦', name: 'Archivist' },
  { icon: '👑', name: 'Grand Keeper' },
];

function SectionHeading({
  prefix,
  highlight,
}: {
  prefix: string;
  highlight: string;
}) {
  return (
    <h2 className="font-serif text-2xl font-semibold text-foreground mb-6">
      {prefix}{' '}
      <span className="text-primary">{highlight}</span>
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
        initial={motionInitialWhenEnabled(reduceMotion)}
        animate={reduceMotion ? false : 'show'}
        variants={staggerContainer}
        className={cn('relative overflow-hidden', glassCard, 'p-8 md:p-10')}
      >
        <div className={cn('absolute inset-0', heroGradient)} />
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <motion.div
          variants={fadeInUp}
          className="relative z-10 flex flex-col items-center gap-8 md:flex-row md:items-start"
        >
          <div className="min-w-0 flex-1 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <IconSparkles className="h-4 w-4" />
              {t('hero.badge')}
            </div>
            <h1 className="font-serif text-3xl font-bold leading-tight text-white md:text-4xl lg:text-5xl">
              {t('hero.titlePrefix')}{' '}
              <span className="text-white/90">{t('hero.titleHighlight')}</span>
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-blue-100 md:mx-0 md:text-lg">
              {t('hero.description')}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-1 md:justify-start">
              <Link href="/contribute">
                <Button
                  size="lg"
                  className="rounded-full bg-white font-semibold text-blue-700 shadow-lg hover:bg-blue-50"
                >
                  <IconPlus className="mr-2 h-4 w-4" />
                  {t('hero.startContributing')}
                </Button>
              </Link>
              <Link href="/graphview">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full border-white/40 bg-white/10 font-semibold text-white hover:bg-white/20 hover:text-white"
                >
                  <IconGraph className="mr-2 h-4 w-4" />
                  {t('hero.exploreGraph')}
                  <IconArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <motion.div variants={scaleIn} className="shrink-0">
            <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-white/30 bg-white/15 backdrop-blur-sm md:h-32 md:w-32">
              <Image
                src="/logo1.svg"
                alt="HeritageGraph"
                width={72}
                height={72}
                className="h-16 w-16 md:h-20 md:w-20"
              />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Mission */}
      <motion.div
        initial={motionInitialWhenEnabled(reduceMotion)}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.2 }}
        variants={fadeInUp}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <IconHeart className="h-5 w-5 text-primary" />
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
        initial={motionInitialWhenEnabled(reduceMotion)}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.15 }}
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
          columns={{ base: 'grid-cols-1', md: 'md:grid-cols-2' }}
        />
      </motion.section>

      {/* Knowledge domains */}
      <motion.section
        initial={motionInitialWhenEnabled(reduceMotion)}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.15 }}
        variants={staggerContainer}
      >
        <motion.div variants={fadeInUp}>
          <SectionHeading
            prefix={t('sections.knowledgeDomains.prefix')}
            highlight={t('sections.knowledgeDomains.highlight')}
          />
        </motion.div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconBooks className="h-5 w-5 text-primary" />
              Heritage categories
            </CardTitle>
            <CardDescription>
              Browse and contribute across the main knowledge domains in the registry.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShortcutGrid
              items={knowledgeDomains}
              variant="compact"
              columns={{ base: 'grid-cols-2', md: 'md:grid-cols-3' }}
            />
          </CardContent>
        </Card>
      </motion.section>

      {/* Progression */}
      <motion.section
        initial={motionInitialWhenEnabled(reduceMotion)}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.15 }}
        variants={staggerContainer}
      >
        <motion.div variants={fadeInUp}>
          <SectionHeading
            prefix={t('sections.progression.prefix')}
            highlight={t('sections.progression.highlight')}
          />
        </motion.div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconTrophy className="h-5 w-5 text-primary" />
              Earn recognition for your contributions
            </CardTitle>
            <CardDescription>
              Track scholarly contributions across disciplines and earn seals, medals, and ranks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {progressionTracks.map((track) => (
                <div
                  key={track.title}
                  className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center"
                >
                  <span className="mb-2 block text-2xl">{track.emoji}</span>
                  <div className="text-sm font-medium">{track.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{track.description}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {tierSummary.map((tier, index) => (
                <div key={tier.name} className="flex items-center">
                  <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5">
                    <span>{tier.icon}</span>
                    <span className="text-sm font-medium">{tier.name}</span>
                  </div>
                  {index < tierSummary.length - 1 ?
                    <IconArrowRight className="mx-1.5 h-4 w-4 text-muted-foreground" />
                  : null}
                </div>
              ))}
            </div>
            <div className="text-center">
              <Link href="/progression">
                <Button>
                  <IconTrophy className="mr-2 h-4 w-4" />
                  View full progression system
                  <IconArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* Tech stack */}
      <motion.section
        initial={motionInitialWhenEnabled(reduceMotion)}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.15 }}
        variants={fadeInUp}
      >
        <SectionHeading
          prefix={t('sections.techStack.prefix')}
          highlight={t('sections.techStack.highlight')}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconCode className="h-5 w-5 text-primary" />
              Built with modern technologies
            </CardTitle>
            <CardDescription>Open-source tools and standards powering the heritage graph.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {techStack.map((tech) => {
                const Icon = tech.icon;
                return (
                  <div
                    key={tech.name}
                    className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/25 p-3"
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <div className="text-sm font-medium">{tech.name}</div>
                      <div className="text-xs text-muted-foreground">{tech.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* CAIR-Nepal */}
      <motion.div
        initial={motionInitialWhenEnabled(reduceMotion)}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.2 }}
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
                    <IconExternalLink className="mr-2 h-4 w-4" />
                    Visit website
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://github.com/CAIRNepal" target="_blank" rel="noopener noreferrer">
                    <IconBrandGithub className="mr-2 h-4 w-4" />
                    GitHub
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="mailto:info@cair-nepal.org">
                    <IconMail className="mr-2 h-4 w-4" />
                    Contact
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={motionInitialWhenEnabled(reduceMotion)}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.2 }}
        variants={fadeInUp}
      >
        <Card className={cn('relative overflow-hidden', glassCard)}>
          <div className={cn('absolute inset-0', heroGradient)} />
          <CardContent className="relative z-10 p-8 text-center">
            <h2 className="font-serif text-2xl font-bold text-white md:text-3xl">{t('cta.title')}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-blue-100">{t('cta.description')}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/contribute">
                <Button
                  size="lg"
                  className="rounded-full bg-white font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <IconPlus className="mr-2 h-4 w-4" />
                  {t('cta.contribute')}
                </Button>
              </Link>
              <Link href="/knowledge/entity">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <IconSearch className="mr-2 h-4 w-4" />
                  {t('cta.browse')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Open source */}
      <motion.div
        initial={motionInitialWhenEnabled(reduceMotion)}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.2 }}
        variants={fadeInUp}
      >
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row">
            <div className="flex items-center gap-4">
              <IconBrandGithub className="h-8 w-8 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">{t('openSource.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('openSource.description')}</p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <a
                href="https://github.com/CAIRNepal/heritagegraph"
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconBrandGithub className="mr-2 h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
