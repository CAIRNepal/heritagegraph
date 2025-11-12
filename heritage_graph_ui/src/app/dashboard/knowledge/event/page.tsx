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
      {/* Versions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Event</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              Represents cultural, religious, or historical occurrences that are significant within a heritage context. Events can include festivals, ceremonies, coronations, rituals, or other gatherings that involve people, locations, and artifacts. Documenting events helps contextualize heritage by showing how cultural practices and artifacts were experienced, celebrated, or utilized.
            </CardDescription>
          </div>

          {/* Links column */}
          <div className="flex flex-col gap-3 md:w-48">
            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/versions-model"
                target="_blank"
                rel="noopener noreferrer"
              >
                Event Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/versions-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Event Curation Docs
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
