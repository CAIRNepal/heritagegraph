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
                  <div className='p-2 pt-3'>
    <SidebarTrigger />
    </div>


        {/* <SidebarTrigger className="-ml-1" /> */}
        {/* <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-10"
        /> */}
{/* <h1 className="text-xl font-extrabold tracking-tight">
  Heritage Graph
</h1> */}
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
      <nav className="ml-auto hidden md:flex items-center gap-3">
        {data.navMain.map((item) => (
          <Link key={item.title} href={item.url} className="flex items-center gap-2 ...">
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
