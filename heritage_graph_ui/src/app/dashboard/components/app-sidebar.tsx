'use client';

import * as React from 'react';
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconBook,
  IconBuilding,
  IconGlobe,
  IconMap,
  IconMusic,
  IconHistory,
} from '@tabler/icons-react';

import { NavDocuments } from '@/components/nav-documents';
import { NavMain } from '@/components/nav-main';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
      icon: IconDashboard,
    },
    {
      title: 'Leaderboard',
      url: '/dashboard/leaderboard',
      icon: IconListDetails,
    },
    {
      title: 'Form',
      url: '/dashboard/contribute',
      icon: IconChartBar,
    },
    {
      title: 'Notification',
      url: '/dashboard/notification',
      icon: IconChartBar,
    },
    {
      title: 'team',
      url: '/dashboard/team',
      icon: IconUsers,
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
      name: 'Monuments',
      url: '/dashboard/knowledge/monuments',
      icon: IconBuilding,
    },
    {
      name: 'Artifacts',
      url: '/dashboard/knowledge/artifacts',
      icon: IconFolder,
    },
    {
      name: 'Festivals & Rituals',
      url: '/dashboard/knowledge/festivals',
      icon: IconHistory,
    },
    {
      name: 'Performing Arts',
      url: '/dashboard/knowledge/performing-arts',
      icon: IconMusic,
    },
    {
      name: 'Languages & Literature',
      url: '/dashboard/knowledge/literature',
      icon: IconBook,
    },
    {
      name: 'People & Lineages',
      url: '/dashboard/knowledge/people',
      icon: IconUsers,
    },
    { name: 'Places', url: '/dashboard/knowledge/places', icon: IconMap },
    {
      name: 'Intangible Heritage',
      url: '/dashboard/knowledge/intangible',
      icon: IconGlobe,
    },
  ],

  navCuration: [
    {
      name: 'Contributions Queue',
      url: '/dashboard/curation/contributions',
      icon: IconFileDescription,
    },
    // { name: "Verification Queue", url: "/curation/verification", icon: IconReport },
    {
      name: 'Activity Log',
      url: '/dashboard/curation/activity',
      icon: IconChartBar,
    },
  ],

  navCommunity: [
    {
      name: 'Contributors',
      url: '/dashboard/community/contributors',
      icon: IconUsers,
    },
    {
      name: 'Organizations',
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
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/dashboard">
                {/* <IconInnerShadowTop className="!size-10" /> */}
                <span className="text-base font-semibold">HeritageGraph</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* <NavMain items={data.navMain} /> */}
        {/* <NavDocuments items={data.data} /> */}
        <NavDocuments items={data.navKnowledgebase} />
        <NavDocuments items={data.navCuration} />
        <NavDocuments items={data.navCommunity} />
        {/* <NavDocuments items={data.navResources} /> */}
        {/* <NavDocuments items={data.navAbout} /> */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
    </Sidebar>
  );
}
