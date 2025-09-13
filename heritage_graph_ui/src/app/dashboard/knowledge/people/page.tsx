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
      {/* Exhibitions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Exhibitions</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              Curated presentations that showcase artifacts, artworks, or collections to
              the public. Exhibitions provide context, interpretation, and narrative to
              highlight cultural, historical, or artistic significance, often combining
              objects, multimedia, and interpretive text to engage and educate
              audiences.
            </CardDescription>
          </div>

          {/* Links column */}
          <div className="flex flex-col gap-3 md:w-48">
            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/exhibition-model"
                target="_blank"
                rel="noopener noreferrer"
              >
                Exhibition Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/exhibition-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Exhibition Curation Docs
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
