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
      {/* Sources Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Sources</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              A collection of references and resources that provide evidence, context,
              and documentation for artifacts, artworks, or cultural collections.
              Sources can include scholarly publications, archival records, expert
              analyses, and other trusted materials used to validate and interpret
              historical or cultural information.
            </CardDescription>
          </div>

          {/* Links column */}
          <div className="flex flex-col gap-3 md:w-48">
            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/source-model"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Source Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/source-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Source Curation Docs
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
