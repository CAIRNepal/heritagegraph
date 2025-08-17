import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/app/dashboard/components/section-cards"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Leaderboard } from "./components/leaderboard-card"
import { Button } from "@/components/ui/button"
import data from "./data.json"

export default function Page() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Compact Welcome Card */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Welcome to HeritageGraph</CardTitle>
        </CardHeader>
        <CardContent className="">
          <p className="text-base text-muted-foreground">
            Explore, preserve, and contribute to the rich cultural heritage through our knowledge graph platform.
          </p>

          {/* Quick links in a compact row */}
          <div className="flex flex-col sm:flex-row gap-2 justify-between">
            <div className="flex-1 flex flex-col items-start p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <span className="font-semibold">📖 Documentation</span>
              <span className="text-muted-foreground">Learn how the platform works.</span>
              <Button size="xs" className="mt-1 w-full">Read Docs</Button>
            </div>

            <div className="flex-1 flex flex-col items-start p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <span className="font-semibold">🤝 Contribute</span>
              <span className="text-muted-foreground">Help preserve cultural heritage.</span>
              <Button size="xs" className="mt-1 w-full">Get Involved</Button>
            </div>

            <div className="flex-1 flex flex-col items-start p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <span className="font-semibold">🌍 Participate</span>
              <span className="text-muted-foreground">Join activities and initiatives.</span>
              <Button size="xs" className="mt-1 w-full">Join Now</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SectionCards & Leaderboard */}
      <div className="flex flex-col md:flex-row gap-4">
        <SectionCards />
        <Leaderboard />
      </div>

      {/* DataTable */}
      <DataTable data={data} />
    </div>
  )
}
