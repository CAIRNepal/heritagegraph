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
          <CardTitle className="text-2xl font-bold">Functions</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              Functions represent the roles or activities associated with artifacts,
              objects, or cultural items. They provide insight into how objects were
              used, their purpose within a historical or cultural context, and the
              practical or symbolic significance they held within their communities.
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
                Functions Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/functions-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Functions Curation Docs
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
