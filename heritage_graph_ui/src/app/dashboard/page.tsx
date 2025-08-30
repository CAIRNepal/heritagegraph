// import { DataTable } from '@/components/data-table';
// import { SectionCards } from '@/app/dashboard/components/section-cards';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Leaderboard } from './components/leaderboard-card';
import { Button } from '@/components/ui/button';
import data from './data.json';
// import { HeritageTable } from '@/components/heritage-table';
import { DataTable } from '@/components/heritage-table';

export default function Page() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Compact Welcome Card */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Welcome Back!</CardTitle>
        </CardHeader>
        <CardContent>
          {/* <p className="text-base text-muted-foreground mb-4">
      Explore, preserve, and contribute to the rich cultural heritage through our knowledge graph platform.
    </p> */}

          <div className="flex flex-col sm:flex-row gap-2 justify-between">
            {[
              {
                title: 'Documentation',
                desc: 'Learn how the platform works.',
                button: 'Read Docs',
              },
              {
                title: 'Contribute',
                desc: 'Help preserve cultural heritage.',
                button: 'Get Involved',
              },
              {
                title: 'Participate',
                desc: 'Join activities and initiatives.',
                button: 'Join Now',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex-1 flex flex-col items-start p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
              >
                <span className="font-semibold">{item.title}</span>
                <span className="text-muted-foreground">{item.desc}</span>
                <Button className="mt-1 w-full">{item.button}</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SectionCards & Leaderboard */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* <SectionCards /> */}
        {/* <Leaderboard /> */}
      </div>

      {/* DataTable */}
      <DataTable />
      {/* <HeritageTable /> */}
    </div>
  );
}
