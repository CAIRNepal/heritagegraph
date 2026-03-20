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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type LeaderboardProps = {
  type: 'Curation' | 'Revisions' | 'Moderation' | 'Forks';
};

export function Leaderboard({ type }: LeaderboardProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/data/leaderboard/?type=${type}`);
        if (!res.ok) throw new Error('Failed to fetch leaderboard data');
        const json = await res.json();
        const results = json.results || json;
        setData(
          (Array.isArray(results) ? results : []).map((entry: any, i: number) => ({
            rank: entry.rank || i + 1,
            name: entry.username || 'Unknown',
            score: entry.score || 0,
            avatar: entry.profile_image || entry.avatar_url || '',
          })),
        );
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [type]);

  return (
    <Card className="w-full shadow-md border border-border">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">🏆 {type} Leaderboard</CardTitle>
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
                <TableHead className="text-right w-[80px]">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center p-4">
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
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={entry.avatar} alt={entry.name} />
                        <AvatarFallback className="text-xs">
                          {entry.name
                            .split(' ')
                            .map((w: string) => w[0])
                            .join('')
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{entry.name}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {entry.score}
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
