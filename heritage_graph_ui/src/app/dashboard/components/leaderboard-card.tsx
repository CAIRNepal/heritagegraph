'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export function Leaderboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const res = await fetch('http://localhost:8000/data/leaderboard/');
        if (!res.ok) throw new Error('Failed to fetch leaderboard data');
        const json = await res.json();
        setData(
          json.map((entry: any, i: number) => ({
            rank: entry.rank || i + 1,
            name: entry.username || 'Unknown',
            avatar: `/avatars/${(entry.username || 'user').toLowerCase()}.png`,
          })),
        );
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <Card className="w-full shadow-md border border-border">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">🏆 Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Rank</TableHead>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center p-4">
                    No data available.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((entry) => (
                  <TableRow
                    key={entry.rank}
                    className={cn(
                      'hover:bg-muted/60',
                      entry.rank === 1 && 'bg-yellow-100/60 dark:bg-yellow-900/20',
                      entry.rank === 2 && 'bg-gray-100 dark:bg-gray-800/20',
                      entry.rank === 3 && 'bg-amber-50 dark:bg-amber-900/20',
                    )}
                  >
                    <TableCell className="font-semibold text-muted-foreground">
                      #{entry.rank}
                    </TableCell>
                    <TableCell className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={entry.avatar} alt={entry.name} />
                        <AvatarFallback>
                          {entry.name
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{entry.name}</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
