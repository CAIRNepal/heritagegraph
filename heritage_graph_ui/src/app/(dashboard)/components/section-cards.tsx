'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import { useSession } from 'next-auth/react';
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import { getPublicApiUrl } from '@/lib/api-base';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { glassCard } from '@/lib/design';

interface Stats {
  total_submissions: number;
  submissions_growth: number;
  approval_rate: number;
  approval_rate_change: number;
  contributor_rank: number;
  rank_change: number;
  community_impact_score: number;
  impact_score_change: number;
}

interface CardData {
  title: string;
  value: string | number;
  change: number;
  changeIsPercent: boolean;
  description: string;
  footer: string;
}

export function SectionCards() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }
    if (status !== 'authenticated') {
      setLoading(false);
      setStats(null);
      setError(null);
      return;
    }
    if (!session?.accessToken) {
      setLoading(false);
      setError(
        'Your session has no API token. Sign out and sign in again with Google.'
      );
      return;
    }

    let cancelled = false;

    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetchJson<Stats>(`${getPublicApiUrl()}/data/api/user-stats/`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
          },
        });
        if (!cancelled) {
          setStats(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            getApiErrorMessage(err, 'Could not load your dashboard statistics.')
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchStats();
    return () => {
      cancelled = true;
    };
  }, [status, session?.accessToken]);

  const UpOrDown: React.FC<{ value: number }> = ({ value }) =>
    value >= 0 ? (
      <IconTrendingUp className="inline w-4 h-4 text-green-500" />
    ) : (
      <IconTrendingDown className="inline w-4 h-4 text-red-500" />
    );

  const formatChange = (val: number, isPercent = false) =>
    `${val >= 0 ? '+' : ''}${val.toFixed(1)}${isPercent ? '%' : ''}`;

  if (loading) {
    return (
      <div className={`${glassCard} p-4`}>
        <div className="text-sm font-medium text-blue-700/80 dark:text-blue-200/70">
          Loading your dashboard overview…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${glassCard} p-4`}>
        <div className="text-sm font-semibold text-red-600 dark:text-red-400">
          Couldn&apos;t load your dashboard overview
        </div>
        <div className="mt-1 text-xs text-blue-700/70 dark:text-blue-200/70">
          {error}
        </div>
      </div>
    );
  }
  if (!stats) return null;

  const cards: CardData[] = [
    {
      title: 'Total Submissions',
      value: stats.total_submissions,
      change: stats.submissions_growth,
      changeIsPercent: true,
      description: 'Based on verified user entries',
      footer: 'Growth this month',
    },
    {
      title: 'Approval Rate',
      value: `${stats.approval_rate.toFixed(1)}%`,
      change: stats.approval_rate_change,
      changeIsPercent: true,
      description: 'Consider reviewing guidelines with contributors',
      footer:
        stats.approval_rate_change >= 0
          ? 'Approval improving'
          : 'Slight drop in approvals',
    },
    {
      title: 'Your Contributor Rank',
      value: `#${stats.contributor_rank}`,
      change: stats.rank_change,
      changeIsPercent: false,
      description: 'Top 50 contributors platform-wide',
      footer: stats.rank_change >= 0 ? 'Rank improved' : 'Rank dropped',
    },
    {
      title: 'Community Impact Score',
      value: `${stats.community_impact_score.toFixed(1)} / 5`,
      change: stats.impact_score_change,
      changeIsPercent: false,
      description: 'Based on peer reviews & curator scores',
      footer:
        stats.impact_score_change >= 0
          ? 'Positive feedback trend'
          : 'Slight decline in feedback',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`${glassCard} p-4 flex flex-col justify-between`}
        >
          <div>
            <p className="text-sm text-blue-700/70 dark:text-blue-200/70">
              {card.title}
            </p>
            <h2 className="text-2xl font-bold mt-1 text-blue-950 dark:text-blue-50">
              {card.value}
            </h2>
            <span className="inline-flex items-center mt-2 text-sm font-medium text-blue-800/80 dark:text-blue-100/80">
              <UpOrDown value={card.change} />
              <span className="ml-1">
                {formatChange(card.change, card.changeIsPercent)}
              </span>
            </span>
          </div>
          <div className="mt-4 text-sm text-blue-700/70 dark:text-blue-200/70">
            <p>
              {card.footer} <UpOrDown value={card.change} />
            </p>
            <p className="mt-1">{card.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
