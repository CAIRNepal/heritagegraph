import { DataTable } from '@/components/heritage-table';
// import { SectionCards } from '@/app/dashboard/components/section-cards';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
// import data from './data.json';
import { Leaderboard } from '../../components/leaderboard-card';

export default function ContributorsPage() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Page Title */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Our Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            HeritageGraph depends on its community to explore, preserve, and contribute
            to cultural knowledge. Anyone can join and start contributing to our
            knowledge graph.
          </p>
        </CardContent>
      </Card>

      {/* Leaderboards Section */}
      <div className="flex flex-col md:flex-row gap-4">
        <Leaderboard type="Curation" />
        <Leaderboard type="Revisions" />
        <Leaderboard type="Moderation" />
      </div>

      {/* Data Table Section */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">All Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable />
        </CardContent>
      </Card>
    </div>
  );
}
