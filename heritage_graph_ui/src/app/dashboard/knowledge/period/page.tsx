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
      {/* Interpretations Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Period</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
          {/* Description column */}
          <div className="flex-1">
            <CardDescription>
            Represents defined eras, dynasties, or significant time spans in history (e.g., Malla, Licchavi). Historical periods provide temporal context for cultural entities, events, locations, and people, helping to organize heritage data chronologically.            
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
                Period Model Docs
              </a>
            </Button>

            <Button asChild variant="outline" size="sm">
              <a
                href="https://example.com/interpretations-curation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Period Curation Docs
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
