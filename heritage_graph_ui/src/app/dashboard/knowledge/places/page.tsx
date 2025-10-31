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
      {/* Cultures Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Cultures</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              Cultures encompass the beliefs, customs, practices, and artistic
              expressions of a community or society. Understanding cultural context
              helps interpret artifacts, traditions, and social behaviors, providing
              insight into how people lived, interacted, and created meaning across time
              and place.
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
                Cultures Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/cultures-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cultures Curation Docs
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
