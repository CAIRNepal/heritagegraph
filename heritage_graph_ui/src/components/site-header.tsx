'use client';

import React from 'react';
import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import {
  // IconChartBar,
  // IconDashboard,
  // IconUsers,
  // IconBell,
  IconSearch,
} from '@tabler/icons-react';
// import AuthButtons from '@/components/AuthButtons';
// import { ThemeToggle } from './theme-toggle';

// const data = {
//   user: {
//     name: 'nabin2004',
//     email: 'nabin.oli@cair-nepal.org',
//     avatar: '/avatars/shadcn.jpg',
//   },
//   navMain: [
//     {
//       title: 'Dashboard',
//       url: '/dashboard',
//       icon: IconDashboard,
//     },
//     {
//       title: 'Leaderboard',
//       url: '/dashboard/leaderboard',
//       icon: IconChartBar,
//     },
//     {
//       title: 'Form',
//       url: '/dashboard/contribute',
//       icon: IconChartBar,
//     },
//     {
//       title: 'Notification',
//       url: '/dashboard/notification',
//       icon: IconBell,
//     },
//     // {
//     //   title: 'Team',
//     //   url: '/dashboard/team',
//     //   icon: IconUsers,
//     // },
//   ],
// };

export function SiteHeader() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    console.log(e.target.value);
    // TODO: implement search functionality later
  };

  return (
    <header className="flex h-[--header-height] shrink-0 items-center gap-4 px-4 lg:px-6">
      {/* Left side */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-10"
        />
<h1 className="text-xl font-extrabold tracking-tight">
  Heritage Graph
</h1>
      </div>

      {/* Search bar */}
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

      {/* Horizontal menu */}
      {/* <nav className="ml-auto hidden md:flex items-center gap-3">
        {data.navMain.map((item) => (
          <a
            key={item.title}
            href={item.url}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </a>
        ))}
      </nav> */}
    </header>
  );
}
