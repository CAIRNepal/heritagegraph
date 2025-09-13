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
      {/* Object Attributes Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Object Attributes</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              Object Attributes are the defining characteristics, properties, or
              metadata of artifacts, objects, or cultural items. They describe features
              such as material, dimensions, origin, condition, and other details that
              help document, classify, and understand the items in collections or
              studies.
            </CardDescription>
          </div>

          {/* Links column */}
          <div className="flex flex-col gap-3 md:w-48">
            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/object-attributes-model"
                target="_blank"
                rel="noopener noreferrer"
              >
                Object Attributes Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/object-attributes-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Object Attributes Curation Docs
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
