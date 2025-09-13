import { DataTable } from '@/components/heritage-table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import data from './data.json';

export default function Page() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Versions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Versions</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              Versions track different states, editions, or iterations of artifacts,
              objects, or datasets. They help document changes over time, highlight
              updates, and provide context for historical, cultural, or scholarly
              analysis. Each version represents a snapshot of the item at a specific
              point in its lifecycle.
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
                Versions Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/versions-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Versions Curation Docs
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <div className="mt-4">
        <DataTable data={data} />
      </div>
    </div>
  );
}
