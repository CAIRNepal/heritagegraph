"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import {
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SectionCards() {
  const { getToken } = useAuth()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await getToken()
        const res = await fetch("http://localhost:8000/data/user-stats/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`)
        }

        const data = await res.json()
        setStats(data)
      } catch (err) {
        console.error("Failed to fetch stats:", err)
        setError(err.message)
      }
    }

    fetchStats()
  }, [getToken])

  if (error) return <div>Error: {error}</div>
  if (!stats) return <div>Loading...</div>

  const {
    total_submissions,
    submissions_growth,
    approval_rate,
    approval_rate_change,
    contributor_rank,
    rank_change,
    community_impact_score,
    impact_score_change,
  } = stats

  const UpOrDown = ({ value }) =>
    value >= 0 ? <IconTrendingUp className="size-4" /> : <IconTrendingDown className="size-4" />

  const formatChange = (val) => `${val >= 0 ? "+" : ""}${val}`

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Submissions</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {total_submissions}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <UpOrDown value={submissions_growth} />
              {formatChange(submissions_growth)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex items-center gap-2 font-medium">
            Growth this month <UpOrDown value={submissions_growth} />
          </div>
          <div className="text-muted-foreground">
            Based on verified user entries
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Approval Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {approval_rate.toFixed(1)}%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <UpOrDown value={approval_rate_change} />
              {formatChange(approval_rate_change)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex items-center gap-2 font-medium">
            {approval_rate_change >= 0
              ? "Approval improving"
              : "Slight drop in approvals"}{" "}
            <UpOrDown value={approval_rate_change} />
          </div>
          <div className="text-muted-foreground">
            Consider reviewing guidelines with contributors
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Your Contributor Rank</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            #{contributor_rank}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <UpOrDown value={rank_change} />
              {formatChange(rank_change)} spots
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex items-center gap-2 font-medium">
            {rank_change >= 0 ? "Rank improved" : "Rank dropped"}{" "}
            <UpOrDown value={rank_change} />
          </div>
          <div className="text-muted-foreground">
            Top 50 contributors platform-wide
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Community Impact Score</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {community_impact_score.toFixed(1)} / 5
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <UpOrDown value={impact_score_change} />
              {formatChange(impact_score_change)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex items-center gap-2 font-medium">
            {impact_score_change >= 0
              ? "Positive feedback trend"
              : "Slight decline in feedback"}{" "}
            <UpOrDown value={impact_score_change} />
          </div>
          <div className="text-muted-foreground">
            Based on peer reviews & curator scores
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
