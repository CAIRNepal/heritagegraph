'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { IconTrendingDown, IconTrendingUp, IconMinus } from '@tabler/icons-react';

import { getPublicApiUrl } from '@/lib/api-base';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { surfaceCard } from '@/lib/design';
import { cn } from '@/lib/utils';

/**
 * Contributor statistics.
 *
 * Every nullable field is null when the quantity has not been measured: no
 * reviewed contributions yet, no previous month to compare against, no earlier
 * snapshot to measure rank movement from. Null is rendered as an explicit
 * "not enough data yet" and is never substituted with a zero or a default —
 * this component previously displayed two hardcoded backend constants as if
 * they were measured trends.
 */
interface Stats {
  total_submissions: number;
  submissions_this_month: number;
  submissions_last_month: number;
  submissions_growth: number | null;
  total_reviewed: number;
  accepted_count: number;
  approval_rate: number | null;
  approval_rate_change: number | null;
  contributor_rank: number | null;
  rank_change: number | null;
}

interface CardData {
  title: string;
  value: string;
  /** Null means "not measured" — the card says so instead of showing an arrow. */
  change: number | null;
  changeUnit: 'percent' | 'percentagePoints' | 'places' | null;
  /** How the figure is derived. Shown on the card so no number is unexplained. */
  basis: string;
  /** Why a null value is null. */
  unmeasuredReason: string;
}

function Delta({
  change,
  unit,
  unmeasuredReason,
  labels,
}: {
  change: number | null;
  unit: CardData['changeUnit'];
  unmeasuredReason: string;
  labels: { noChange: string };
}) {
  if (change === null || unit === null) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">{unmeasuredReason}</p>
    );
  }

  const rounded = Number(change.toFixed(1));
  const suffix =
    unit === 'percent' ? '%' : unit === 'percentagePoints' ? ' pp' : '';

  if (rounded === 0) {
    return (
      <span className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <IconMinus className="size-4" aria-hidden />
        {labels.noChange}
      </span>
    );
  }

  const improved = rounded > 0;
  const Icon = improved ? IconTrendingUp : IconTrendingDown;

  return (
    <span
      className={cn(
        'mt-2 inline-flex items-center gap-1 text-sm font-medium',
        improved ? 'text-primary' : 'text-destructive',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {`${improved ? '+' : ''}${rounded}${suffix}`}
    </span>
  );
}

export function SectionCards() {
  const { data: session, status } = useSession();
  const t = useTranslations('dashboard.stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'authenticated') {
      setLoading(false);
      setStats(null);
      setError(null);
      return;
    }
    if (!session?.accessToken) {
      setLoading(false);
      setError(t('noToken'));
      return;
    }

    let cancelled = false;

    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetchJson<Stats>(
          `${getPublicApiUrl()}/data/api/user-stats/`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${session.accessToken}`,
            },
          },
        );
        if (!cancelled) setStats(data);
      } catch (err: unknown) {
        if (!cancelled) setError(getApiErrorMessage(err, t('loadFailed')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchStats();
    return () => {
      cancelled = true;
    };
  }, [status, session?.accessToken, t]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(surfaceCard, 'p-4')}>
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-7 w-16 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-3 w-full animate-pulse rounded bg-muted" />
          </div>
        ))}
        <span className="sr-only">{t('loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(surfaceCard, 'p-4')} role="alert">
        <p className="text-sm font-semibold text-destructive">{t('loadFailed')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const cards: CardData[] = [
    {
      title: t('submissions.title'),
      value: String(stats.total_submissions),
      change: stats.submissions_growth,
      changeUnit: 'percent',
      basis: t('submissions.basis', {
        thisMonth: stats.submissions_this_month,
        lastMonth: stats.submissions_last_month,
      }),
      unmeasuredReason: t('submissions.unmeasured'),
    },
    {
      title: t('approval.title'),
      value:
        stats.approval_rate === null
          ? t('notYet')
          : `${stats.approval_rate.toFixed(1)}%`,
      change: stats.approval_rate_change,
      changeUnit: 'percentagePoints',
      basis: t('approval.basis', {
        accepted: stats.accepted_count,
        reviewed: stats.total_reviewed,
      }),
      unmeasuredReason:
        stats.total_reviewed === 0
          ? t('approval.unmeasuredNoReviews')
          : t('approval.unmeasuredNoCohort'),
    },
    {
      title: t('rank.title'),
      value:
        stats.contributor_rank === null ? t('notYet') : `#${stats.contributor_rank}`,
      change: stats.rank_change,
      changeUnit: 'places',
      basis: t('rank.basis'),
      unmeasuredReason: t('rank.unmeasured'),
    },
    {
      title: t('reviewed.title'),
      value: String(stats.total_reviewed),
      change: null,
      changeUnit: null,
      basis: t('reviewed.basis', { pending: Math.max(
        0,
        stats.total_submissions - stats.total_reviewed,
      ) }),
      unmeasuredReason: t('reviewed.pending', {
        pending: Math.max(0, stats.total_submissions - stats.total_reviewed),
      }),
    },
  ];

  return (
    <div
      className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4"
      aria-live="polite"
    >
      {cards.map((card) => (
        <div
          key={card.title}
          className={cn(surfaceCard, 'flex flex-col justify-between p-4')}
        >
          <div>
            <p className="text-sm text-muted-foreground">{card.title}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{card.value}</p>
            <Delta
              change={card.change}
              unit={card.changeUnit}
              unmeasuredReason={card.unmeasuredReason}
              labels={{ noChange: t('noChange') }}
            />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {card.basis}
          </p>
        </div>
      ))}
    </div>
  );
}
