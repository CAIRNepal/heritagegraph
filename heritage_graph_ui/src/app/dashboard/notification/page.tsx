'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { BellIcon } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const PAGE_SIZE = 2;

const notifications = [
  {
    id: 1,
    title: 'New submission received',
    message: 'Alice just submitted a form for review.',
    avatar: '/cair-logo/nabin.jpeg',
    time: '2m ago',
    type: 'form',
  },
  {
    id: 2,
    title: 'Leaderboard updated',
    message: 'Charlie moved up to #3 on the leaderboard.',
    avatar: '/cair-logo/niraj.jpeg',
    time: '15m ago',
    type: 'rank',
  },
  {
    id: 3,
    title: 'System update',
    message: 'Maintenance scheduled for this weekend.',
    avatar: '',
    time: '1h ago',
    type: 'system',
  },
  {
    id: 4,
    title: 'Message from moderator',
    message: 'Your submission was approved. Great job!',
    avatar: '/cair-logo/nabin.jpeg',
    time: '3h ago',
    type: 'approval',
  },
];

export default function NotificationPage() {
  const [page, setPage] = useState(1);

  const pageCount = Math.ceil(notifications.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const currentPageItems = notifications.slice(start, start + PAGE_SIZE);

  return (
    <div className="font-sans min-h-screen p-6 sm:p-12 bg-background text-foreground">
      <main className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <BellIcon className="w-6 h-6" /> Notifications
          </h1>
        </div>

        <Card className="shadow-md border border-border">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Recent Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[500px]">
              <ul className="space-y-4">
                {currentPageItems.map(({ id, title, message, avatar, time, type }) => (
                  <li
                    key={id}
                    className="flex gap-4 items-start border-b last:border-0 border-muted/40 pb-4"
                  >
                    <Avatar className="mt-1">
                      {avatar ? (
                        <AvatarImage src={avatar} alt={title} />
                      ) : (
                        <AvatarFallback>
                          <BellIcon className="w-4 h-4" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium leading-tight">{title}</h3>
                        <span className="text-xs text-muted-foreground">{time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{message}</p>
                      <Badge variant="outline" className="mt-2">
                        {type}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>

            {pageCount > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-disabled={page === 1}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm px-2">
                      Page {page} of {pageCount}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      aria-disabled={page === pageCount}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
