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
      {/* Interpretations Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Interpretations</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
              Interpretations are analytical or curatorial insights that explain the
              meaning, significance, or context of artifacts, artworks, or cultural
              items. They synthesize evidence from multiple sources to provide
              understanding of historical, cultural, or artistic perspectives,
              highlighting symbolism, function, and broader impact.
            </CardDescription>
          </div>

          {/* Links column */}
          <div className="flex flex-col gap-3 md:w-48">
            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/interpretations-model"
                target="_blank"
                rel="noopener noreferrer"
              >
                Interpretations Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/interpretations-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Interpretations Curation Docs
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
