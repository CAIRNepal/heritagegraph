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
      {/* Composite Objects Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Composite Objects</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              Composite Objects are artifacts or collections made up of multiple
              interconnected items, elements, or components. They often represent
              complex cultural, historical, or artistic assemblies and are documented to
              highlight their structure, significance, and the relationships between
              individual components.
            </CardDescription>
          </div>

          {/* Links column */}
          <div className="flex flex-col gap-3 md:w-48">
            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/composite-object-model"
                target="_blank"
                rel="noopener noreferrer"
              >
                Composite Object Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/composite-object-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Composite Object Curation Docs
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
