"use client"

import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

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
  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {[
        {
          title: "Total Submissions",
          value: "1,250",
          change: "+12.5%",
          trend: "up",
          description: "Growth this month",
          footnote: "Based on verified user entries"
        },
        {
          title: "Approval Rate",
          value: "72.4%",
          change: "-4.1%",
          trend: "down",
          description: "Slight drop in approvals",
          footnote: "Consider reviewing guidelines with contributors"
        },
        {
          title: "Your Contributor Rank",
          value: "#47",
          change: "+2 spots",
          trend: "up",
          description: "Rank improved",
          footnote: "Top 50 contributors platform-wide"
        },
        {
          title: "Community Impact Score",
          value: "4.5 / 5",
          change: "+0.3",
          trend: "up",
          description: "Positive feedback trend",
          footnote: "Based on peer reviews & curator scores"
        }
      ].map((card, index) => (
        <Card 
          key={index}
          className="bg-white/80 backdrop-blur-sm border border-blue-200 hover:border-blue-300 transition-colors"
        >
          <CardHeader>
            <CardDescription className="text-blue-700">{card.title}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums text-blue-900 @[250px]/card:text-3xl">
              {card.value}
            </CardTitle>
            <CardAction>
              <Badge 
                variant="outline" 
                className={`border-blue-200 ${
                  card.trend === 'up' ? 'text-blue-600' : 'text-amber-600'
                }`}
              >
                {card.trend === 'up' ? (
                  <IconTrendingUp className="size-4" />
                ) : (
                  <IconTrendingDown className="size-4" />
                )}
                {card.change}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className={`flex items-center gap-2 font-medium ${
              card.trend === 'up' ? 'text-blue-600' : 'text-amber-600'
            }`}>
              {card.description} {card.trend === 'up' ? (
                <IconTrendingUp className="size-4" />
              ) : (
                <IconTrendingDown className="size-4" />
              )}
            </div>
            <div className="text-blue-600/80">
              {card.footnote}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}