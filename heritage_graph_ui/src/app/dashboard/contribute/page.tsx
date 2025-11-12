'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Grid } from '@/components/ui/grid';

const CONTRIBUTION_TYPES = [
  { name: 'Entity', path: '/dashboard/contribute/entity', description: 'Add historical figures, monuments, artifacts, etc.' },
  { name: 'Event', path: '/dashboard/contribute/event', description: 'Add festivals, rituals, or historical events' },
  { name: 'Location', path: '/dashboard/contribute/location', description: 'Add cities, regions, or heritage sites' },
  { name: 'Period', path: '/dashboard/contribute/period', description: 'Add historical periods or eras' },
  { name: 'Person', path: '/dashboard/contribute/person', description: 'Add notable historical figures or cultural icons' },
  { name: 'Places', path: '/dashboard/contribute/places', description: 'Add physical sites, landmarks, or sacred places' },
  { name: 'Source', path: '/dashboard/contribute/source', description: 'Add books, archives, or references' },
  { name: 'Tradition', path: '/dashboard/contribute/tradition', description: 'Add cultural practices, dances, music, rituals' },
];

export default function ContributeDashboard() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold">Contribute Knowledge</h1>
        <p className="text-muted-foreground mt-2">
          Choose a category to contribute cultural, historical, or heritage information.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {CONTRIBUTION_TYPES.map((item) => (
          <Card key={item.name} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end">
              <Button onClick={() => router.push(item.path)}>Contribute</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
