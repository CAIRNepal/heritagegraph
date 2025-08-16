"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";

export function SectionCards() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await getToken();
        const res = await fetch("http://localhost:8000/data/user-stats/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        console.log("DATA: ", data)
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [getToken]);

  const UpOrDown = ({ value }) =>
    value >= 0 ? <IconTrendingUp className="inline w-4 h-4 text-green-500" /> : <IconTrendingDown className="inline w-4 h-4 text-red-500" />;

  const formatChange = (val, isPercent = false) =>
    `${val >= 0 ? "+" : ""}${val.toFixed(1)}${isPercent ? "%" : ""}`;

  if (loading) return <div className="text-gray-500 font-medium"></div>;
  if (error) return <div className="text-red-500 font-medium">Error: {error}</div>;

  const cards = [
    {
      title: "Total Submissions",
      value: stats.total_submissions,
      change: stats.submissions_growth,
      changeIsPercent: true,
      description: "Based on verified user entries",
      footer: "Growth this month",
    },
    {
      title: "Approval Rate",
      value: `${stats.approval_rate.toFixed(1)}%`,
      change: stats.approval_rate_change,
      changeIsPercent: true,
      description: "Consider reviewing guidelines with contributors",
      footer: stats.approval_rate_change >= 0 ? "Approval improving" : "Slight drop in approvals",
    },
    {
      title: "Your Contributor Rank",
      value: `#${stats.contributor_rank}`,
      change: stats.rank_change,
      changeIsPercent: false,
      description: "Top 50 contributors platform-wide",
      footer: stats.rank_change >= 0 ? "Rank improved" : "Rank dropped",
    },
    {
      title: "Community Impact Score",
      value: `${stats.community_impact_score.toFixed(1)} / 5`,
      change: stats.impact_score_change,
      changeIsPercent: false,
      description: "Based on peer reviews & curator scores",
      footer: stats.impact_score_change >= 0 ? "Positive feedback trend" : "Slight decline in feedback",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4 p-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 flex flex-col justify-between border border-gray-200 dark:border-gray-700"
        >
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{card.title}</p>
            <h2 className="text-2xl font-bold mt-1">{card.value}</h2>
            <span className="inline-flex items-center mt-2 text-sm font-medium text-gray-600 dark:text-gray-300">
              <UpOrDown value={card.change} />
              <span className="ml-1">{formatChange(card.change, card.changeIsPercent)}</span>
            </span>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
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
