'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from "next/image";
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';

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
  IconMedal,
  IconInfoCircle,
  IconChevronUp,
  IconGitFork,
  IconSettings,
  IconListCheck,
} from '@tabler/icons-react';

// import { useSidebar } from '@/components/ui/sidebar';
// import { NavDocuments } from '@/components/nav-documents';
import { NavMain } from '@/components/nav-main';
import { NavKnowledgebase } from '@/components/nav-knowledgebase';
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

import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import { useOntology } from "@/lib/ontology";

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
  //     url: '/leaderboard',
  //     icon: IconTrophy,
  //   },
  //   {
  //     title: 'Contribute',
  //     url: '/contribute',
  //     icon: IconPlus,
  //   },
  //   {
  //     title: 'Notification',
  //     url: '/notification',
  //     icon: IconBell,
  //   },
  //   {
  //     title: 'team',
  //     url: '/team',
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
      url: '/knowledge/entity',
      icon: IconBuildingCommunity,
    },
    {
      title: 'Person',
      url: '/knowledge/person',
      icon: IconUser,
    },
    {
      title: 'Location',
      url: '/knowledge/location',
      icon: IconMapPin,
    },
    // {
    //   title: 'Object Attributes',
    //   url: '/knowledge/performing-arts',
    //   icon: IconMusic,
    // },
    {
      title: 'Event',
      url: '/knowledge/event',
      icon: IconCalendarEvent,
    },
    {
      title: 'Historical Period',
      url: '/knowledge/period',
      icon: IconClock,
    },
    {
      title: 'Tradition / Practice',
      url: '/knowledge/tradition',
      icon: IconFlame
    },
    {
      title: 'Source',
      url: '/knowledge/source',
      icon: IconInvoice,
    },
    {
      title: 'Deity',
      url: '/knowledge/deity',
      icon: IconMoodSmile,
    },
    {
      title: 'Guthi',
      url: '/knowledge/guthi',
      icon: IconHomeCog,
    },
    {
      title: 'Structure',
      url: '/knowledge/structure',
      icon: IconBuildingArch,
    },
    {
      title: 'Ritual',
      url: '/knowledge/ritual',
      icon: IconCandle,
    },
    {
      title: 'Festival',
      url: '/knowledge/festival',
      icon: IconConfetti,
    },
    {
      title: 'Iconography',
      url: '/knowledge/iconography',
      icon: IconPalette,
    },
    {
      title: 'Monument',
      url: '/knowledge/monument',
      icon: IconColumns,
    },
  ],

  navCuration: [
    {
      title: 'Reviewer Dashboard',
      url: '/curation/dashboard',
      icon: IconDashboard,
    },
    {
      title: 'Review Queue',
      url: '/curation/review',
      icon: IconShield,
    },
    {
      title: 'Conflicts',
      url: '/curation/conflicts',
      icon: IconScale,
    },
    {
      title: 'Fork Viewer',
      url: '/curation/forks',
      icon: IconGitFork,
    },
    {
      title: 'Contributions Queue',
      url: '/curation/contributions',
      icon: IconFileDescription,
    },
    {
      title: 'Activity Log',
      url: '/curation/activity',
      icon: IconChartBar,
    },
    {
      title: 'QR Contributions',
      url: '/curation/qr-contributions',
      icon: IconQrcode,
    },
  ],

  navCommunity: [
    {
      title: 'Contributors',
      url: '/community/contributors',
      icon: IconUsers,
    },
    {
      title: 'Organizations',
      url: '/community/organizations',
      icon: IconBuilding,
    },
    // { name: "Leaderboard", url: "/community/leaderboard", icon: IconListDetails },
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

const API_BASE = getPublicApiUrl();

interface SidebarRoles {
  isModerator: boolean;
  isReviewer: boolean;
  isPlatformAdmin: boolean;
}

function useSidebarRoles(): SidebarRoles {
  const { data: session, status } = useSession();
  const [roles, setRoles] = React.useState<SidebarRoles>({
    isModerator: false,
    isReviewer: false,
    isPlatformAdmin: false,
  });

  React.useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    if (!API_BASE) return;

    (async () => {
      try {
        const data = await apiFetchJson<{
          groups?: string[];
          is_staff?: boolean;
          reviewer_role?: { is_active?: boolean; can_manage_roles?: boolean } | null;
        }>(`${API_BASE}/api/user/info`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
          },
        });
        const groups: string[] = data.groups || [];
        const isStaff = data.is_staff || false;
        const hasActiveReviewerRole = data.reviewer_role?.is_active ?? false;
        const canManageRoles = data.reviewer_role?.can_manage_roles ?? false;
        const isMod = isStaff || groups.includes('Moderators');
        setRoles({
          isModerator: isMod,
          isReviewer: isMod || groups.includes('Reviewers') || hasActiveReviewerRole,
          isPlatformAdmin: isStaff || (hasActiveReviewerRole && canManageRoles),
        });
      } catch (err) {
        // Avoid console noise in production; roles will remain false.
      }
    })();
  }, [session, status]);

  return roles;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const t = useTranslations('nav');
  const { status } = useSession();
  const showAuthedNav = status === 'authenticated';
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const { isModerator, isReviewer, isPlatformAdmin } = useSidebarRoles();
  const { registry } = useOntology();

  const knowledgeBrowseItems = React.useMemo(
    () => {
      const iconMap: Record<string, unknown> = {
        user: IconUser,
        "map-pin": IconMapPin,
        calendar: IconCalendarEvent,
        clock: IconClock,
        flame: IconFlame,
        "book-open": IconInvoice,
        sun: IconMoodSmile,
        users: IconUsers,
        landmark: IconBuildingArch,
        "flame-kindling": IconCandle,
        "party-popper": IconConfetti,
        image: IconPalette,
        columns: IconColumns,
        shuffle: IconGitFork,
        "badge-check": IconShield,
        database: IconInvoice,
      };

      return Object.values(registry.classes)
        .filter((c) => c.navigable)
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((c) => ({
          title: c.label,
          url: `/knowledge/${c.key}`,
          icon: c.icon ? iconMap[c.icon] : undefined,
        }));
    },
    [registry.classes],
  );

  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 80);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    <Link href="/" className="flex items-center">
          <Image
            src={isCollapsed ? "/logo1.svg" : "/logo.svg"}
            alt="logo"
            width={isCollapsed? 40: 150}
            height={isCollapsed? 40: 150}
            sizes={isCollapsed ? "40px" : "150px"}
          />
      {/* <span className="">HeritageGraph</span> */}
    </Link>
  </div>

</SidebarMenuButton>


      </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent ref={contentRef} className="relative pb-6">
        {showScrollTop && (
          <>
            <div className="pointer-events-none sticky top-0 z-10 h-8 -mb-8 bg-gradient-to-b from-sidebar to-transparent" />
            <button
              onClick={scrollToTop}
              className="sticky top-1 z-20 mx-auto flex items-center gap-1 rounded-full bg-blue-500/90 dark:bg-blue-600/90 px-3 py-1 text-[11px] font-medium text-white shadow-md backdrop-blur-sm transition-all hover:bg-blue-600 dark:hover:bg-blue-500 hover:shadow-lg"
            >
              <IconChevronUp className="size-3.5" />
              {!isCollapsed && <span>Scroll to top</span>}
            </button>
          </>
        )}

        <NavMain
          navtitle={t('navigation')}
          items={[
            { title: t('dashboard'), url: '/', icon: IconLayoutDashboard },
            { title: t('graphVisualization'), url: '/graphview', icon: IconGraph },
            { title: t('contribute'), url: '/contribute', icon: IconPlus },
            ...(showAuthedNav
              ? [{ title: t('progression'), url: '/progression', icon: IconMedal }]
              : []),
            { title: t('leaderboard'), url: '/leaderboard', icon: IconTrophy },
            ...(showAuthedNav
              ? [{ title: t('notifications'), url: '/notification', icon: IconBell }]
              : []),
            { title: t('team'), url: '/team', icon: IconUsersGroup },
            { title: t('about'), url: '/about', icon: IconInfoCircle },
          ]}
        />

        <NavKnowledgebase
          sectionTitle={t('knowledgebase')}
          hubTitle={t('knowledgeHub')}
          hubUrl="/knowledge/entity"
          hubIcon={IconBuildingCommunity}
          browseLabel={t('browseByType')}
          items={knowledgeBrowseItems}
        />
        <NavMain navtitle={t('curation')} items={[
          ...(isModerator ? [{ title: t('reviewerDashboard'), url: '/curation/dashboard', icon: IconDashboard }] : []),
          ...(isReviewer ? [
            { title: t('reviewQueue'), url: '/curation/review', icon: IconShield },
            { title: 'Identity queue', url: '/curation/identity', icon: IconGitFork },
            { title: 'Review workspace', url: '/review', icon: IconListCheck },
            { title: t('conflicts'), url: '/curation/conflicts', icon: IconScale },
          ] : []),
          { title: t('contributionsQueue'), url: '/curation/contributions', icon: IconFileDescription },
          { title: t('activityLog'), url: '/curation/activity', icon: IconChartBar },
          { title: t('qrContributions'), url: '/curation/qr-contributions', icon: IconQrcode },
        ]} />
        <NavMain navtitle={t('community')} items={[
          { title: t('contributors'), url: '/community/contributors', icon: IconUsers },
          { title: t('organizations'), url: '/community/organizations', icon: IconBuilding },
        ]} />
        {isPlatformAdmin ? (
          <NavMain
            navtitle={t('platformAdmin')}
            items={[
              {
                title: t('platformAdminUsers'),
                url: '/platform-admin/users',
                icon: IconSettings,
              },
            ]}
          />
        ) : null}
      </SidebarContent>
      {/* <AuthSection /> */}
    </Sidebar>
  );
}
