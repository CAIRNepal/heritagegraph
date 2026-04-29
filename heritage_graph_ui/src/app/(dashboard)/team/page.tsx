'use client';

/**
 * OurTeam page — /team
 *
 * Renders two sections:
 *  1. Core Team  — curated CAIR-Nepal members with local profile photos.
 *  2. GitHub Contributors — all repo contributors from /api/github-contributors
 *     (server-side proxy to the GitHub API, cached for 1 hour).
 */

import Image from 'next/image';
import { motion } from 'framer-motion';
import { IconSparkles, IconBrandGithub } from '@tabler/icons-react';
import { ExternalLink, GitCommit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fadeInUp, staggerContainer, scaleIn, glassCard } from '@/lib/design';
import { useEffect, useState } from 'react';

import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';

/**
 * Curated core team members shown in the "Meet the Team" grid.
 * Add/remove entries here as the team changes.
 * `image` paths are relative to /public.
 * `profileUrl` links to the member's CAIR-Nepal profile page — rendered as
 * a semantic <a> tag for SEO crawlability.
 */
const teamMembers: Array<{
  name: string;
  role: string;
  image: string;
  profileUrl: string;
  githubLogin?: string;
  githubLogins?: string[];
}> = [
  {
    name: 'Dr. Tek Raj Chhetri',
    role: 'Project Lead | Researcher in AI and Digital Heritage',
    image: '/cair-logo/tekraj.jpeg',
    profileUrl: 'http://www.cair-nepal.org/team/members/tek-raj-chhetri/',
    githubLogins: ['tekrajchhetri'],
  },
  { name: 'Dr. Semih Yumusak', role: 'Advisor | Semantic Web and Knowledge Graph Expert', image: '/cair-logo/semih.jpeg', profileUrl: 'http://www.cair-nepal.org/team/members/dr-semih-yumusak/' },
  {
    name: 'Nabin Oli',
    role: 'Machine Learning Researcher | Data & Graph Modeling',
    image: '/cair-logo/nabin.jpeg',
    profileUrl: 'http://www.cair-nepal.org/team/members/nabin-oli/',
    githubLogins: ['nabin2004'],
  },
  {
    name: 'Niraj Karki',
    role: 'Software Engineer | Backend & Infrastructure',
    image: '/cair-logo/niraj.jpeg',
    profileUrl: 'http://www.cair-nepal.org/team/members/niraj-karki/',
    githubLogin: 'nirajkarki',
    githubLogins: ['nirajkark'],
  },
  { name: 'Anu Sapkota', role: 'Researcher | Cultural Heritage & Knowledge Systems', image: '/cair-logo/anu_sapkota.jpeg', profileUrl: 'http://www.cair-nepal.org/team/members/anu-sapkota/' },
];

interface GitHubContributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

export default function OurTeam() {
  const [contributors, setContributors] = useState<GitHubContributor[]>([]);
  // Drives the loading spinner while the fetch is in-flight.
  const [loadingContributors, setLoadingContributors] = useState(true);
  const [contributorsError, setContributorsError] = useState<string | null>(null);

  const coreTeamLogins = new Set(
    teamMembers.flatMap((member) => {
      const aliases = member.githubLogins ?? [];
      const primary = member.githubLogin ? [member.githubLogin] : [];
      return [...primary, ...aliases]
        .map((login) => login.trim().toLowerCase())
        .filter(Boolean);
    })
  );

  const flaggedContributors = contributors.map((c) => ({
    ...c,
    isCoreTeam: coreTeamLogins.has(c.login.toLowerCase()),
  }));

  const visibleContributors = flaggedContributors.filter((c) => !c.isCoreTeam);

  const coreTeamContributorCount = flaggedContributors.filter((c) => c.isCoreTeam).length;

  useEffect(() => {
    /**
     * Fetch via our internal proxy (/api/github-contributors) rather than
     * calling api.github.com directly from the browser.
     *
     * Benefits of the proxy:
     *  - Runs server-side → avoids the browser's 60 req/h unauthenticated limit.
     *  - Response is cached for 1 hour (Next.js revalidate), so every page
     *    load reuses the cached result instead of hitting GitHub each time.
     *
     */
    (async () => {
      try {
        const data = await apiFetchJson<GitHubContributor[]>('/api/github-contributors', {
          headers: { Accept: 'application/json' },
        });
        if (!Array.isArray(data)) return;

        setContributors(data);
      } catch (err) {
        setContributorsError(
          getApiErrorMessage(err, 'Could not load contributors from GitHub.')
        );
      } finally {
        setLoadingContributors(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* ── Hero Header ── */}
      {/*
        Full-bleed gradient card at the top. The decorative blurred circles
        are purely cosmetic — they add depth without affecting layout.
      */}
      <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8 md:p-10`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-sky-300/20 rounded-full blur-2xl animate-pulse" />
        <motion.div variants={fadeInUp} className="relative z-10 space-y-3 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white mx-auto">
            <IconSparkles className="w-4 h-4" /> Our Team
          </div>
          <h1 className="text-3xl md:text-4xl font-black leading-tight text-white">
            The Minds Behind{' '}
            <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">HeritageGraph</span>
          </h1>
          <p className="text-blue-100 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            A multidisciplinary team working at the intersection of artificial intelligence,
            cultural heritage, and digital knowledge systems.
          </p>
        </motion.div>
      </motion.div>

      {/* ── Team Grid ──
          Iterates over `teamMembers` above. Each card shows a circular profile
          photo (served from /public/cair-logo/) with a subtle glow and an
          animated gradient text effect on hover.
      */}
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
        <motion.h2 variants={fadeInUp} className="text-2xl font-bold mb-6 text-blue-900 dark:text-blue-100">
          Meet the{' '}
          <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">Team</span>
        </motion.h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {teamMembers.map((member) => (
            <motion.div key={member.name} variants={scaleIn} className="group relative">
              {/* Semantic <a> wrapping the entire card — crawlable by search engines */}
              <a
                href={member.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${member.name}'s profile on CAIR-Nepal`}
                className="block"
              >
                <div className={`relative p-6 ${glassCard} hover:bg-white dark:hover:bg-gray-900 transition-all duration-500 transform hover:scale-[1.02] overflow-hidden hover:shadow-xl`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-sky-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl" />
                  <div className="flex gap-4 items-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-sky-500 rounded-full blur-sm opacity-50" />
                      <Image
                        src={member.image}
                        alt={member.name}
                        width={72}
                        height={72}
                        className="relative rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-lg"
                        sizes="72px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">
                        {member.name}
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">{member.role}</p>
                    </div>
                    {/* External link indicator — visible on hover */}
                    <ExternalLink className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex-shrink-0" />
                  </div>
                </div>
              </a>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── GitHub Contributors — filtered list from the API ── */}
      {(loadingContributors || contributors.length > 0 || contributorsError) && (
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
        <motion.div variants={fadeInUp} className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <IconBrandGithub className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              GitHub{' '}
              <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">Contributors</span>
            </h2>
          </div>

          {!loadingContributors && !contributorsError && contributors.length > 0 && (
            <div className="text-xs text-muted-foreground hidden sm:block">
              Showing <span className="font-medium text-foreground">{visibleContributors.length}</span> non-core contributors
              {' '}of <span className="font-medium text-foreground">{contributors.length}</span> total
              {coreTeamContributorCount > 0 && (
                <>
                  {' '}· <span className="font-medium text-foreground">{coreTeamContributorCount}</span> core team hidden
                </>
              )}
            </div>
          )}
        </motion.div>

        {loadingContributors ? (
          /* Spinner — shown while the proxy fetch is in-flight */
          <motion.div variants={fadeInUp} className={`${glassCard} p-8 flex items-center justify-center`}>
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading contributors…</span>
            </div>
          </motion.div>
        ) : contributorsError ? (
          <motion.div variants={fadeInUp} className={`${glassCard} p-6 text-sm text-muted-foreground`}>
            {contributorsError}
          </motion.div>
        ) : (
          /* Contributor grid */
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {visibleContributors.map((contributor) => (
              <motion.a
                key={contributor.login}
                variants={scaleIn}
                href={contributor.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <div className={`relative p-5 ${glassCard} hover:bg-white dark:hover:bg-gray-900 transition-all duration-500 transform hover:scale-[1.03] overflow-hidden hover:shadow-xl`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-sky-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl" />
                  {'isCoreTeam' in contributor && contributor.isCoreTeam && (
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center rounded-full border border-blue-200/60 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-blue-700 backdrop-blur-sm dark:border-blue-500/30 dark:bg-gray-950/50 dark:text-blue-300">
                        Core team
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-sky-500 rounded-full blur-sm opacity-40" />
                      <Image
                        src={contributor.avatar_url}
                        alt={contributor.login}
                        width={56}
                        height={56}
                        className="relative rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-md"
                        sizes="56px"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-blue-900 dark:text-blue-100 truncate group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">
                        {contributor.login}
                      </p>
                      <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mt-0.5">
                        <GitCommit className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{contributor.contributions} commit{contributor.contributions !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </motion.div>
      )}

      {/* ── Action Links ──
          Quick-access buttons to the GitHub repository and the CAIR-Nepal
          website. Positioned at the bottom so they don't distract from
          the team content above.
      */}
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeInUp} className="flex gap-4 flex-col sm:flex-row">
        <Button size="lg" className="bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white rounded-full font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 gap-2" asChild>
          <a href="https://github.com/CAIRNepal/heritagegraph" target="_blank" rel="noopener noreferrer">
            <IconBrandGithub className="w-5 h-5" /> View GitHub
          </a>
        </Button>
        <Button variant="outline" size="lg" className="border-blue-300 dark:border-gray-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-full font-semibold transition-all duration-300 gap-2" asChild>
          <a href="https://www.cair-nepal.org/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" /> Read Docs
          </a>
        </Button>
      </motion.div>
    </div>
  );
}
