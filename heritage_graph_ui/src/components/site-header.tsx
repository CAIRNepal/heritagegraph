'use client';

import React from 'react';
import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  IconBell,
  IconLayoutDashboard,
  IconTrophy,
  IconPlus,
  IconUsersGroup,

  IconSearch,
} from '@tabler/icons-react';
// import AuthButtons from '@/components/AuthButtons';
// import { ThemeToggle } from './theme-toggle';

const data = {
  user: {
    name: 'nabin2004',
    email: 'nabin.oli@cair-nepal.org',
    avatar: '/avatars/shadcn.jpg',
  },
  navMain: [
    {  
      title: 'Dashboard',
      url: '/dashboard',
      icon: IconLayoutDashboard,
    },
    {
      title: 'Leaderboard',
      url: '/dashboard/leaderboard',
      icon: IconTrophy,
    },
    {
      title: 'Contribute',
      url: '/dashboard/contribute',
      icon: IconPlus,
    },
    {
      title: 'Notification',
      url: '/dashboard/notification',
      icon: IconBell,
    },
    {
      title: 'team',
      url: '/dashboard/team',
      icon: IconUsersGroup,
    },
  ],
};

export function SiteHeader({ compact }: { compact?: boolean } = { compact: false }) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    console.log(e.target.value);
    // TODO: implement search functionality later
  };

  return (
    <header
      className={`flex items-center gap-4 px-4 lg:px-6 ${compact ? 'h-12' : 'h-[--header-height]'} shrink-0`}
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        <div className="p-1">
          <SidebarTrigger />
        </div>
        <Link href="/" className="flex items-center gap-2">
          <img src="/cair-logo/fulllogo_nobuffer.png" alt="HeritageGraph" className={`h-8 ${compact ? 'w-auto' : 'w-10'}`} />
          {!compact && <span className="font-semibold text-lg">Heritage Graph</span>}
        </Link>
      </div>

      {/* Search - hidden in compact */}
      {!compact && (
        <div className="ml-6 hidden md:flex items-center gap-2">
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-64"
          />
          <IconSearch className="w-4 h-4 text-muted-foreground" />
        </div>
      )}

      {/* Horizontal menu - hide on compact (sidebar handles navigation) */}
      {!compact && (
        <nav className="ml-auto hidden md:flex items-center gap-3">
          {data.navMain.map((item) => (
            <Link key={item.title} href={item.url} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent/5">
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          ))}
        </nav>
      )}

      {/* Right side controls - always visible but compact shows icons only */}
      <div className="ml-auto flex items-center gap-3">
        <button aria-label="Notifications" className="p-2 rounded hover:bg-accent/5">
          <IconBell className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <img src={data.user.avatar} alt={data.user.name} className="w-8 h-8 rounded-full" />
          {!compact && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium">{data.user.name}</span>
              <span className="text-xs text-muted-foreground">{data.user.email}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
