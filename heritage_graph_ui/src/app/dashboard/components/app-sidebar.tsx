'use client';

import * as React from 'react';
// import Link from 'next/link';
import {
  IconCamera,
  IconChartBar,
  IconLayoutDashboard,
  IconTrophy,
  IconPlus,
  IconBell,
  IconUsersGroup,
  IconBuildingCommunity,
  IconUser,
  IconMapPin,
  IconCalendarEvent,
  IconClock,
  IconFlame,
  IconFileAi,
  IconInvoice,
  IconFileDescription,
  IconUsers,
  IconBuilding,
} from '@tabler/icons-react';
// import { NavDocuments } from '@/components/nav-documents';
import { NavMain } from '@/components/nav-main';
// import { NavSecondary } from '@/components/nav-secondary';
// import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  // SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

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
    // {
    //   title: "Team",
    //   url: "#",
    //   icon: IconUsers,
    // },
  ],
  navClouds: [
    {
      title: 'Capture',
      icon: IconCamera,
      isActive: true,
      url: '#',
      items: [
        {
          title: 'Active Proposals',
          url: '#',
        },
        {
          title: 'Archived',
          url: '#',
        },
      ],
    },
    {
      title: 'Proposal',
      icon: IconFileDescription,
      url: '#',
      items: [
        {
          title: 'Active Proposals',
          url: '#',
        },
        {
          title: 'Archived',
          url: '#',
        },
      ],
    },
    {
      title: 'Prompts',
      icon: IconFileAi,
      url: '#',
      items: [
        {
          title: 'Active Proposals',
          url: '#',
        },
        {
          title: 'Archived',
          url: '#',
        },
      ],
    },
  ],
  navSecondary: [
    // {
    //   title: "Settings",
    //   url: "#",
    //   icon: IconSettings,
    // },
    // {
    //   title: "Get Help",
    //   url: "#",
    //   icon: IconHelp,
    // },
    // {
    //   title: "Search",
    //   url: "#",
    //   icon: IconSearch,
    // },
  ],
  // data: [
  //   {
  //     name: "Graph Library",
  //     url: "#",
  //     icon: IconDatabase,
  //   },
  //   {
  //     name: "Graph Explore",
  //     url: "#",
  //     icon: IconReport,
  //   },
  //   {
  //     name: "SPARQL",
  //     url: "#",
  //     icon: IconFileWord,
  //   },
  // ],

  navKnowledgebase: [
    {
      title: 'Cultural Entity',
      url: '/dashboard/knowledge/entity',
      icon: IconBuildingCommunity,
    },
    {
      title: 'Person',
      url: '/dashboard/knowledge/person',
      icon: IconUser,
    },
    {
      title: 'Location',
      url: '/dashboard/knowledge/location',
      icon: IconMapPin,
    },
    // {
    //   title: 'Object Attributes',
    //   url: '/dashboard/knowledge/performing-arts',
    //   icon: IconMusic,
    // },
    {
      title: 'Event',
      url: '/dashboard/knowledge/event',
      icon: IconCalendarEvent,
    },
    {
      title: 'Historical Period',
      url: '/dashboard/knowledge/period',
      icon: IconClock,
    },
    { 
      title: 'Tradition / Practice', 
      url: '/dashboard/knowledge/tradition', 
      icon: IconFlame 
    },
    {
      title: 'Source',
      url: '/dashboard/knowledge/source',
      icon: IconInvoice,
    },
  ],

  navCuration: [
    {
      title: 'Contributions Queue',
      url: '/dashboard/curation/contributions',
      icon: IconFileDescription,
    },
    // { name: "Verification Queue", url: "/curation/verification", icon: IconReport },
    {
      title: 'Activity Log',
      url: '/dashboard/curation/activity',
      icon: IconChartBar,
    },
  ],

  navCommunity: [
    {
      title: 'Contributors',
      url: '/dashboard/community/contributors',
      icon: IconUsers,
    },
    {
      title: 'Organizations',
      url: '/dashboard/community/organizations',
      icon: IconBuilding,
    },
    // { name: "Leaderboard", url: "/dashboard/community/leaderboard", icon: IconListDetails },
  ],

  navResources: [
    // { name: 'Data Releases', url: '/resources/releases', icon: IconDatabase },
    // { name: 'Data Licensing', url: '/resources/licensing', icon: IconFileWord },
    // { name: 'APIs & Tools', url: '/resources/apis', icon: IconFileAi },
  ],

  navAbout: [
    // { name: 'About', url: '/about', icon: IconHelp },
    // { name: 'Documentation', url: '/docs', icon: IconFileDescription },
    // { name: 'Contact', url: '/contact', icon: IconSearch },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              {/* <Link href="/"> */}
              {/* <IconInnerShadowTop className="!size-10" /> */}
              {/* <span className="text-base font-semibold">HeritageGraph</span> */}
              {/* </Link> */}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavMain items={data.navKnowledgebase} />
        {/* <NavDocuments items={data.navKnowledgebase} /> */}
        <NavMain items={data.navCuration} />
        <NavMain items={data.navCommunity} />
        {/* <NavDocuments items={data.navResources} /> */}
        {/* <NavDocuments items={data.navAbout} /> */}
        <NavMain items={data.navSecondary}/>
      </SidebarContent>
      {/* <AuthSection /> */}
    </Sidebar>
  );
}
