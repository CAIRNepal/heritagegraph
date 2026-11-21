'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  IconAlertCircle,
  IconArchive,
  IconArrowRight,
  IconFlask,
  IconLogin,
  IconPencil,
  IconPhoto,
  IconSearch,
} from '@tabler/icons-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RankAvatar, type TierType } from '@/components/rank-avatar';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import {
  fadeInUp,
  motionInitialWhenEnabled,
  staggerContainer,
  surfaceCard,
} from '@/lib/design';
import { cn } from '@/lib/utils';

const API_BASE_URL = getPublicApiUrl();

/**
 * Contribution record.
 *
 * Everything shown here is either a count of rows that exist or a value the
 * backend computes with the published formula. This page previously described a
 * scoring and awards system that was largely not implemented — a
 * `ContributionWeight` term absent from the backend, a 1.25x solo multiplier
 * that did not exist, a 2,500-entry public register that is capped at 50,
 * seal-based tier requirements when tiers are point thresholds, and campaigns
 * with no model behind them. If you add a claim here, implement it first.
 */

/** Contribution categories, mirroring the backend's per-track scoring. */
const TRACKS = [
  { id: 'curation', icon: IconArchive },
  { id: 'annotation', icon: IconPencil },
  { id: 'verification', icon: IconSearch },
  { id: 'exhibition', icon: IconPhoto },
] as const;

/** Mirrors `_TIER_THRESHOLDS` in apps/heritage_data/views.py. */
const TIER_THRESHOLDS: { id: TierType; points: number }[] = [
  { id: 'apprentice', points: 0 },
  { id: 'scholar', points: 100 },
  { id: 'curator', points: 500 },
  { id: 'archivist', points: 1500 },
  { id: 'grandkeeper', points: 5000 },
];

/** Mirrors `_compute_medals_from_rank`: percentile bands, not campaign awards. */
const MEDAL_BANDS = [
  { id: 'gold', percentile: 10 },
  { id: 'silver', percentile: 20 },
  { id: 'bronze', percentile: 40 },
] as const;

interface TrackProgress {
  id: string;
  tier: string;
  points: number;
  nextTierPoints: number;
  percentage: number;
}

interface UserProgress {
  tier: string;
  tierId: string;
  rank: number;
  totalPoints: number;
  tracks: TrackProgress[];
  medals: { gold: number; silver: number; bronze: number };
  nextTierPoints: number;
  pointsToNextTier: number;
  progressPercent: number;
  breakdown: {
    entities: number;
    acceptedEntities: number;
    revisions: number;
    reviews: number;
    submissions: number;
  };
  fullName: string;
  institution: string;
  profileImage: string;
}

interface LeaderboardEntry {
  user_id: number;
  username: string;
  full_name: string;
  institution: string;
  profile_image: string;
  score: number;
  tier_id: string;
  rank: number;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={cn(surfaceCard, 'p-4')}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={cn(surfaceCard, 'p-4')}>
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-7 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export default function ProgressionPage() {
  const { data: session, status } = useSession();
  const t = useTranslations('progression');
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = status === 'authenticated';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = (session as { accessToken?: string } | null)?.accessToken;
      if (token) headers.Authorization = `Bearer ${token}`;

      const data = await apiFetchJson<{
        leaderboard?: LeaderboardEntry[];
        user_progress?: UserProgress;
      }>(`${API_BASE_URL}/data/api/progression/`, { headers });

      setLeaderboard(data.leaderboard ?? []);
      setProgress(data.user_progress ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err, t('loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [session, t]);

  useEffect(() => {
    if (status === 'loading') return;
    void load();
  }, [status, load]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 pb-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold text-foreground">{t('title')}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('intro')}</p>
      </header>

      {error ? (
        <div className={cn(surfaceCard, 'p-4')} role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <IconAlertCircle className="size-4" aria-hidden />
            {t('loadFailed')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {/* ── 1. The verifiable record ──
          Counts of rows that exist lead the page. Rank is derived and volatile,
          so it is reported further down rather than as the headline. */}
      <motion.section
        initial={motionInitialWhenEnabled(false)}
        animate="show"
        variants={staggerContainer}
      >
        <motion.h2
          variants={fadeInUp}
          className="mb-6 font-serif text-2xl font-semibold text-foreground"
        >
          {t('record.heading')}
        </motion.h2>

        {!isAuthenticated ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <IconLogin className="size-10 text-muted-foreground" aria-hidden />
              <div>
                <h3 className="font-semibold text-foreground">{t('record.signInTitle')}</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  {t('record.signInBody')}
                </p>
              </div>
              <Button onClick={() => signIn('google', { callbackUrl: '/progression' })}>
                <IconLogin className="mr-2 size-4" />
                {t('record.signIn')}
              </Button>
            </CardContent>
          </Card>
        ) : loading && !progress ? (
          <LoadingSkeleton />
        ) : !progress ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t('record.empty')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label={t('record.submitted')}
                value={progress.breakdown.entities.toLocaleString()}
                hint={t('record.submittedHint')}
              />
              <Stat
                label={t('record.accepted')}
                value={progress.breakdown.acceptedEntities.toLocaleString()}
                hint={t('record.acceptedHint')}
              />
              <Stat
                label={t('record.revisions')}
                value={progress.breakdown.revisions.toLocaleString()}
                hint={t('record.revisionsHint')}
              />
              <Stat
                label={t('record.reviews')}
                value={progress.breakdown.reviews.toLocaleString()}
                hint={t('record.reviewsHint')}
              />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t('record.byCategory')}</CardTitle>
                <CardDescription>{t('record.byCategoryHint')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {TRACKS.map(({ id, icon: Icon }) => {
                  const tp = progress.tracks.find((x) => x.id === id);
                  return (
                    <div key={id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          <Icon className="size-4 text-primary" aria-hidden />
                          {t(`tracks.${id}.name`)}
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {(tp?.points ?? 0).toLocaleString()} {t('points')}
                        </span>
                      </div>
                      <ProgressBar value={tp?.points ?? 0} max={tp?.nextTierPoints || 1} />
                      <p className="text-xs text-muted-foreground">{t(`tracks.${id}.desc`)}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </motion.section>

      {/* ── 2. How scoring works ──
          Stated plainly rather than styled as a terminal readout. Every value
          below is mirrored from the backend constants. */}
      <section>
        <h2 className="mb-6 font-serif text-2xl font-semibold text-foreground">
          {t('scoring.heading')}
        </h2>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('scoring.formulaTitle')}</CardTitle>
            <CardDescription>{t('scoring.formulaLead')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-center font-mono text-sm text-foreground">
              P(t) = BaseScore × e<sup>−λ(t − 180)</sup>
            </p>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {['t', 'lambda', 'grace'].map((k) => (
                <div key={k} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <dt className="font-mono text-sm text-foreground">{t(`scoring.terms.${k}.symbol`)}</dt>
                  <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t(`scoring.terms.${k}.meaning`)}
                  </dd>
                </div>
              ))}
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {t('scoring.tiersTitle')}
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('scoring.tierCol')}</TableHead>
                      <TableHead className="text-right">{t('scoring.thresholdCol')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TIER_THRESHOLDS.map((tier) => (
                      <TableRow key={tier.id}>
                        <TableCell className="font-medium">{t(`tiers.${tier.id}`)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {tier.points.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {t('scoring.medalsTitle')}
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {MEDAL_BANDS.map((band) => (
                  <li key={band.id}>
                    {t('scoring.medalBand', {
                      medal: t(`medals.${band.id}`),
                      percentile: band.percentile,
                    })}
                  </li>
                ))}
              </ul>
            </div>

            <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              {t('scoring.caveat')}
            </p>

            <Button variant="outline" size="sm" asChild>
              <Link href="/methods">
                <IconFlask className="mr-2 size-4" />
                {t('scoring.methodsCta')}
                <IconArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* ── 3. Community register ── */}
      <section>
        <h2 className="mb-6 font-serif text-2xl font-semibold text-foreground">
          {t('register.heading')}
        </h2>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('register.title')}</CardTitle>
            <CardDescription>{t('register.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && leaderboard.length === 0 ? (
              <LoadingSkeleton />
            ) : leaderboard.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('register.empty')}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">{t('register.rankCol')}</TableHead>
                      <TableHead>{t('register.contributorCol')}</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        {t('register.institutionCol')}
                      </TableHead>
                      <TableHead className="text-right">{t('register.pointsCol')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((row) => (
                      <TableRow key={row.user_id}>
                        <TableCell className="font-mono tabular-nums text-muted-foreground">
                          {row.rank}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <RankAvatar
                              src={row.profile_image}
                              name={row.full_name || row.username}
                              tier={(row.tier_id as TierType) || 'apprentice'}
                              size="sm"
                            />
                            <span className="font-medium text-foreground">
                              {row.full_name || row.username}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                          {row.institution || '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {row.score.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {t('register.footnote')}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
