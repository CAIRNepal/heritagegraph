import { DataTable } from '@/components/heritage-table';
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
  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Functions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Location</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              Locations represent physical or geographical sites associated with cultural heritage. 
              These include historical sites, monuments, museums, regions, and cities. Documenting 
              locations helps contextualize artifacts, events, and traditions within their spatial 
              and cultural settings, allowing researchers and the public to explore heritage geographically.
            </CardDescription>
          </div>

          {/* Links column */}
          <div className="flex flex-col gap-3 md:w-48">
            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/functions-model"
                target="_blank"
                rel="noopener noreferrer"
              >
                Location Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/functions-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Location Curation Docs
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
