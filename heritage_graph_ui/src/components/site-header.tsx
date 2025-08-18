'use client';

import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  IconChartBar,
  IconDashboard,
  IconListDetails,
  IconUsers,
} from '@tabler/icons-react';
import { BellDotIcon, BellIcon } from 'lucide-react';

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
      icon: IconDashboard,
    },
    {
      title: 'Leaderboard',
      url: '/dashboard/leaderboard',
      icon: IconChartBar,
    },
    {
      title: 'Form',
      url: '/dashboard/contribute',
      icon: IconChartBar,
    },
    {
      title: 'Notification',
      url: '/dashboard/notification',
      icon: BellIcon,
    },

    {
      title: 'Team',
      url: '/dashboard/team',
      icon: IconUsers,
    },
  ],
};

export function SiteHeader() {
  return (
    <header className="flex h-[--header-height] shrink-0 items-center gap-4  px-4 lg:px-6">
      {/* Left side */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-semibold">HeritageGraph1</h1>
      </div>

      {/* Horizontal menu */}
      <nav className="ml-auto hidden md:flex items-center gap-6">
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
      </nav>
    </header>
  );
}
