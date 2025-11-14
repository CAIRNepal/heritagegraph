import { DataTable } from './heritage-table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// import data from './data.json';

export default function Page() {
  const submissions = [
  {
    submission_id: "1",
    title: "Test Submission",
    description: "Some description",
    contributor: 42,
    contributor_username: "nabin",
    status: "pending",
    created_at: new Date().toISOString(),
  },
  {
    submission_id: "2",
    title: "Another Submission",
    description: "More info",
    contributor: 43,
    contributor_username: "alex",
    status: "approved",
    created_at: new Date().toISOString(),
  },
];

  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Cultures Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Places</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              Represents physical or geographical sites associated with cultural heritage. This includes temples, monuments, historical cities, museums, regions, and other sites where cultural activities or artifacts are found. Locations provide spatial context, helping to map, explore, and understand the distribution of heritage objects and events.            
            </CardDescription>
          </div>

          {/* Links column */}
          <div className="flex flex-col gap-3 md:w-48">
            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/cultures-model"
                target="_blank"
                rel="noopener noreferrer"
              >
                Places Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/cultures-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Places Curation Docs
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <div className="mt-4">

    <DataTable />

      </div>
    </div>
  );
}