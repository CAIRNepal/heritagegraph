'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/heritage-table';

export default function Page() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.accessToken) return;
    

    const fetchBackend = async () => {
      try {
        const res = await fetch('http://localhost:8000/data/testthelogin/', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.detail || 'Failed to fetch data');
        }

        const data = await res.json();
        console.log('Data: ', data);
      } catch (_err: any) {
        console.error('Error fetching backend data:', _err.message);
      }
    };

    fetchBackend();
  }, [session]);

  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Compact Welcome Card */}
      <CardTitle className="text-2xl font-bold">Welcome to Heritage Graph</CardTitle>
      <p>Heritage Graph is a project by CAIR-Nepal for preserving cultural heritages using Knowledge Graphs.</p>
      <Card className="rounded-2xl shadow-md">
        {/* <CardHeader> */}
          {/* <CardTitle className="text-2xl font-bold">Welcome Back!</CardTitle> */}
        {/* </CardHeader> */}
        <CardContent>
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
                className="flex-1 flex flex-col items-start rounded-lg"
              >
                <span className="font-semibold">{item.title}</span>
                <span className="text-muted-foreground">{item.desc}</span>
                <Button className="mt-1 w-full">{item.button}</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* DataTable */}
      <DataTable />

    </div>
  );
}
