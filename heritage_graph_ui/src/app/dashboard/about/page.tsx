'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  IconPhoto,
  IconFileDescription,
  IconBrandPython,
  IconBrandReact,
  IconApi,
  IconWorld,
} from '@tabler/icons-react';

/* ── Animation variants ── */
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const scaleIn = {
  hidden: { scale: 0.95, opacity: 0 },
  show: { scale: 1, opacity: 1, transition: { duration: 0.4 } },
};

/* ── Feature data ── */
const coreFeatures = [
  {
    title: 'Knowledge Graph',
    description: 'Explore heritage data through an interactive ontology-driven graph visualization powered by CIDOC-CRM standards.',
    icon: IconGraph,
    gradient: 'from-violet-500 to-purple-600',
    href: '/dashboard/graphview',
  },
  {
    title: 'Linked Open Data',
    description: 'All heritage records are published as machine-readable Linked Open Data, enabling interoperability across archives.',
    icon: IconDatabase,
    gradient: 'from-blue-500 to-cyan-600',
  },
  {
    title: 'Community Curation',
    description: 'Crowdsourced contributions from scholars, institutions, and community members with peer review quality assurance.',
    icon: IconUsers,
    gradient: 'from-emerald-500 to-teal-600',
    href: '/dashboard/community/contributors',
  },
  {
    title: 'Epistemic Review',
    description: 'Three-persona review system ensures scholarly rigor: community reviewers, domain experts, and expert curators.',
    icon: IconShield,
    gradient: 'from-amber-500 to-orange-600',
    href: '/dashboard/curation/review',
  },
];

/* ── Knowledge domains ── */
const knowledgeDomains = [
  { name: 'Cultural Entities', icon: IconBuildingCommunity, href: '/dashboard/knowledge/entity' },
  { name: 'Historical Persons', icon: IconUsers, href: '/dashboard/knowledge/person' },
  { name: 'Heritage Locations', icon: IconMapPin, href: '/dashboard/knowledge/location' },
  { name: 'Cultural Events', icon: IconCalendarEvent, href: '/dashboard/knowledge/event' },
  { name: 'Traditions & Practices', icon: IconFlame, href: '/dashboard/knowledge/tradition' },
  { name: 'Documentary Sources', icon: IconFileDescription, href: '/dashboard/knowledge/source' },
];

/* ── Tech stack ── */
const techStack = [
  { name: 'Django REST Framework', description: 'Python backend API', icon: IconBrandPython },
  { name: 'Next.js 15', description: 'React frontend with App Router', icon: IconBrandReact },
  { name: 'CIDOC-CRM', description: 'Heritage ontology standard', icon: IconDatabase },
  { name: 'Linked Open Data', description: 'RDF/SPARQL capabilities', icon: IconWorld },
  { name: 'PostgreSQL', description: 'Relational database', icon: IconDatabase },
  { name: 'REST + GraphQL', description: 'Flexible API access', icon: IconApi },
];

/* ── Progression summary ── */
const progressionHighlights = [
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

export default function AboutPage() {
  const t = useTranslations('about');
  return (
    <div className="space-y-8">
      {/* ── Hero Section ── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-sky-300/20 rounded-full blur-2xl animate-pulse" />

        <div className="relative z-10 p-8 md:p-12">
          <motion.div variants={fadeInUp} className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
                <IconSparkles className="w-4 h-4" />
                {t('hero.badge')}
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight text-white">
                {t('hero.titlePrefix')}{' '}
                <span className="bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-300 bg-clip-text text-transparent">
                  {t('hero.titleHighlight')}
                </span>
              </h1>
              <p className="text-blue-100 text-lg md:text-xl leading-relaxed max-w-2xl">
                {t('hero.description')}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/dashboard/contribute">
                  <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 rounded-full font-semibold shadow-lg">
                    <IconPlus className="w-4 h-4 mr-2" />
                    {t('hero.startContributing')}
                  </Button>
                </Link>
                <Link href="/dashboard/graphview">
                  <Button variant="outline" size="lg" className="bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white rounded-full font-semibold">
                    <IconGraph className="w-4 h-4 mr-2" />
                    {t('hero.exploreGraph')}
                    <IconArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
            <motion.div variants={scaleIn} className="flex-shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/30">
                <Image
                  src="/logo1.svg"
                  alt="HeritageGraph Logo"
                  width={80}
                  height={80}
                  className="w-20 h-20 md:w-24 md:h-24"
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* ── Mission Statement ── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
      >
        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-amber-700 dark:text-amber-300">
                <IconHeart className="w-6 h-6" />
                {t('mission.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                {t('mission.paragraph1')}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong>{t('mission.appName')}</strong> {t('mission.paragraph2')}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Core Features ── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
      >
        <motion.h2 variants={fadeInUp} className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t('sections.coreFeatures.prefix')}{' '}
          <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">
            {t('sections.coreFeatures.highlight')}
          </span>
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coreFeatures.map((feature) => {
            const Icon = feature.icon;
            const content = (
              <Card key={feature.title} className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${feature.gradient}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-lg mb-2">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            );
            return feature.href ? (
              <motion.div key={feature.title} variants={fadeInUp}>
                <Link href={feature.href}>{content}</Link>
              </motion.div>
            ) : (
              <motion.div key={feature.title} variants={fadeInUp}>
                {content}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Knowledge Domains ── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
      >
        <motion.h2 variants={fadeInUp} className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t('sections.knowledgeDomains.prefix')}{' '}
          <span className="text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text">
            {t('sections.knowledgeDomains.highlight')}
          </span>
        </motion.h2>
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBooks className="w-5 h-5 text-blue-600" />
                Heritage Categories
              </CardTitle>
              <CardDescription>
                Browse and contribute to our growing knowledge base across multiple heritage domains
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {knowledgeDomains.map((domain) => {
                  const Icon = domain.icon;
                  return (
                    <Link key={domain.name} href={domain.href}>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-muted/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                        <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium">{domain.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Progression System Summary ── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
      >
        <motion.h2 variants={fadeInUp} className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t('sections.progression.prefix')}{' '}
          <span className="text-transparent bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text">
            {t('sections.progression.highlight')}
          </span>
        </motion.h2>
        <motion.div variants={fadeInUp}>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6 text-white">
              <div className="flex items-center gap-3 mb-3">
                <IconTrophy className="w-6 h-6 text-yellow-400" />
                <h3 className="text-xl font-bold">Earn Recognition for Your Contributions</h3>
              </div>
              <p className="text-gray-300">
                Track your scholarly contributions across four disciplines and earn seals, medals, and ranks 
                that reflect your sustained commitment to heritage preservation.
              </p>
            </div>
            <CardContent className="p-6 space-y-6">
              {/* Contribution Tracks */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Contribution Tracks</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {progressionHighlights.map((track) => (
                    <div key={track.title} className="text-center p-4 rounded-lg bg-muted/30">
                      <span className="text-3xl mb-2 block">{track.emoji}</span>
                      <div className="font-medium text-sm">{track.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{track.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tier Progression */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Rank Progression</h4>
                <div className="flex flex-wrap justify-center gap-3">
                  {tierSummary.map((tier, index) => (
                    <div key={tier.name} className="flex items-center">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-gray-200 dark:border-gray-700">
                        <span className="text-xl">{tier.icon}</span>
                        <span className="text-sm font-medium">{tier.name}</span>
                      </div>
                      {index < tierSummary.length - 1 && (
                        <IconArrowRight className="w-4 h-4 text-muted-foreground mx-2" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center pt-2">
                <Link href="/dashboard/progression">
                  <Button className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white">
                    <IconTrophy className="w-4 h-4 mr-2" />
                    View Full Progression System
                    <IconArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Tech Stack ── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
      >
        <motion.h2 variants={fadeInUp} className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t('sections.techStack.prefix')}{' '}
          <span className="text-transparent bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text">
            {t('sections.techStack.highlight')}
          </span>
        </motion.h2>
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCode className="w-5 h-5 text-violet-600" />
                Built with Modern Technologies
              </CardTitle>
              <CardDescription>
                Open-source tools and standards powering the heritage graph
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {techStack.map((tech) => {
                  const Icon = tech.icon;
                  return (
                    <div key={tech.name} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <Icon className="w-5 h-5 text-violet-600 dark:text-violet-400 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">{tech.name}</div>
                        <div className="text-xs text-muted-foreground">{tech.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── CAIR-Nepal ── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
      >
        <motion.div variants={fadeInUp}>
          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/3 bg-gradient-to-br from-blue-600 to-sky-600 p-8 flex items-center justify-center">
                <div className="text-center">
                  <img
                    src="/cair-logo/fulllogo_nobuffer.png"
                    alt="CAIR-Nepal"
                    width={200}
                    height={80}
                    className="w-40 h-auto mx-auto brightness-0 invert"
                  />
                  <p className="text-blue-100 mt-4 text-sm">
                    {t('cair.subtitle')}
                  </p>
                </div>
              </div>
              <div className="md:w-2/3 p-8">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{t('cair.title')}</h3>
                <p className="text-muted-foreground mb-4">
                  {t('cair.description')}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://www.cair-nepal.org/" target="_blank" rel="noopener noreferrer">
                      <IconExternalLink className="w-4 h-4 mr-2" />
                      Visit Website
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://github.com/CAIRNepal" target="_blank" rel="noopener noreferrer">
                      <IconBrandGithub className="w-4 h-4 mr-2" />
                      GitHub
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="mailto:info@cair-nepal.org">
                      <IconMail className="w-4 h-4 mr-2" />
                      Contact
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Get Involved CTA ── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
      >
        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white overflow-hidden">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('cta.title')}</h2>
              <p className="text-emerald-100 mb-6 max-w-2xl mx-auto">
                {t('cta.description')}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/dashboard/contribute">
                  <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50 rounded-full font-semibold shadow-lg">
                    <IconPlus className="w-4 h-4 mr-2" />
                    {t('cta.contribute')}
                  </Button>
                </Link>
                <Link href="/dashboard/knowledge/entity">
                  <Button variant="outline" size="lg" className="border-white/40 text-white hover:bg-white/20 rounded-full font-semibold">
                    <IconSearch className="w-4 h-4 mr-2" />
                    {t('cta.browse')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Open Source Notice ── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
      >
        <motion.div variants={fadeInUp}>
          <Card className="border-dashed">
            <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <IconBrandGithub className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{t('openSource.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('openSource.description')}
                  </p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <a href="https://github.com/CAIRNepal/heritagegraph" target="_blank" rel="noopener noreferrer">
                  <IconBrandGithub className="w-4 h-4 mr-2" />
                  View on GitHub
                </a>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
