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
      {/* Sources Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Cultural Entity</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              Cultural entities represent tangible or intangible heritage objects, 
              institutions, or concepts that embody the identity, history, or 
              traditions of a culture. Examples include artifacts, monuments, 
              historical sites, and collections that are documented, preserved, 
              and studied to understand cultural heritage.
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
                Cultural Entity Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/source-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cultural Entity Curation Docs
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
