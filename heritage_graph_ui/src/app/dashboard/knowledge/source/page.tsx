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
      {/* Object Attributes Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Source</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
                Represents references or documentation that provide evidence, context, or validation for cultural heritage entities, events, people, locations, or traditions. Sources can include scholarly publications, archival records, manuscripts, oral histories, research papers, or digital media. They ensure the accuracy, credibility, and traceability of the knowledge captured in the heritage knowledge graph.
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
                Source Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/object-attributes-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Source Curation Docs
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
