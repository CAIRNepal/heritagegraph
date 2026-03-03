'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from "next/image";

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
  IconMoodSmile,
  IconHomeCog,
  IconBuildingArch,
  IconCandle,
  IconConfetti,
  IconPalette,
  IconColumns,
  IconShield,
  IconScale,
  IconAlertTriangle,
  IconDashboard,
  IconGraph,
  IconQrcode,
} from '@tabler/icons-react';

// import { useSidebar } from '@/components/ui/sidebar';
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
  SidebarTrigger,
  useSidebar,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';

const data = {
  user: {
    name: 'nabin2004',
    email: 'nabin.oli@cair-nepal.org',
    avatar: '/avatars/shadcn.jpg',
  },
  // navMain: [
  //   {
  //     title: 'Dashboard',
  //     url: '/dashboard',
  //     icon: IconLayoutDashboard,
  //   },
  //   {
  //     title: 'Leaderboard',
  //     url: '/dashboard/leaderboard',
  //     icon: IconTrophy,
  //   },
  //   {
  //     title: 'Contribute',
  //     url: '/dashboard/contribute',
  //     icon: IconPlus,
  //   },
  //   {
  //     title: 'Notification',
  //     url: '/dashboard/notification',
  //     icon: IconBell,
  //   },
  //   {
  //     title: 'team',
  //     url: '/dashboard/team',
  //     icon: IconUsersGroup,
  //   },
  //   // {
  //   //   title: "Team",
  //   //   url: "#",
  //   //   icon: IconUsers,
  //   // },
  // ],
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
    {
      title: 'Deity',
      url: '/dashboard/knowledge/deity',
      icon: IconMoodSmile,
    },
    {
      title: 'Guthi',
      url: '/dashboard/knowledge/guthi',
      icon: IconHomeCog,
    },
    {
      title: 'Structure',
      url: '/dashboard/knowledge/structure',
      icon: IconBuildingArch,
    },
    {
      title: 'Ritual',
      url: '/dashboard/knowledge/ritual',
      icon: IconCandle,
    },
    {
      title: 'Festival',
      url: '/dashboard/knowledge/festival',
      icon: IconConfetti,
    },
    {
      title: 'Iconography',
      url: '/dashboard/knowledge/iconography',
      icon: IconPalette,
    },
    {
      title: 'Monument',
      url: '/dashboard/knowledge/monument',
      icon: IconColumns,
    },
  ],

  navCuration: [
    {
      title: 'Reviewer Dashboard',
      url: '/dashboard/curation/dashboard',
      icon: IconDashboard,
    },
    {
      title: 'Review Queue',
      url: '/dashboard/curation/review',
      icon: IconShield,
    },
    {
      title: 'Conflicts',
      url: '/dashboard/curation/conflicts',
      icon: IconScale,
    },
    {
      title: 'Contributions Queue',
      url: '/dashboard/curation/contributions',
      icon: IconFileDescription,
    },
    {
      title: 'Activity Log',
      url: '/dashboard/curation/activity',
      icon: IconChartBar,
    },
    {
      title: 'QR Contributions',
      url: '/dashboard/curation/qr-contributions',
      icon: IconQrcode,
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
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";


  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            
<SidebarMenuButton
  asChild
  className="data-[slot=sidebar-menu-button]:!p-1.5"
>
  <div className="flex items-center justify-between w-full h-full">
    <Link href="/dashboard" className="flex items-center">
          <Image
            src={isCollapsed ? "/logo1.svg" : "/logo.svg"}
            alt="logo"
            width={isCollapsed? 40: 150}
            height={isCollapsed? 40: 150}
          />
      {/* <span className="">HeritageGraph</span> */}
    </Link>
  </div>

</SidebarMenuButton>


      </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* Quick-access items previously in the top header */}
        <NavMain navtitle="Navigation" items={[
          { title: 'Dashboard', url: '/dashboard', icon: IconLayoutDashboard },
          { title: 'Graph Visualization', url: '/dashboard/graphview', icon: IconGraph },
          { title: 'Contribute', url: '/dashboard/contribute', icon: IconPlus },
          { title: 'Leaderboard', url: '/dashboard/leaderboard', icon: IconTrophy },
          { title: 'Notifications', url: '/dashboard/notification', icon: IconBell },
          { title: 'Team', url: '/dashboard/team', icon: IconUsersGroup },
        ]} />

        <NavMain navtitle="Knowledgebase" items={data.navKnowledgebase} />
        <NavMain navtitle="Curation" items={data.navCuration} />
        <NavMain navtitle="Community" items={data.navCommunity} />
        {/* <NavDocuments items={data.navResources} /> */}
        {/* <NavDocuments items={data.navAbout} /> */}
        {/* <NavMain items={data.navSecondary}/> */}
      </SidebarContent>
      {/* <AuthSection /> */}
    </Sidebar>
  );
}
