'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from "next/image";
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';

import {
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
  IconInvoice,
  IconFileDescription,
  IconUsers,
  IconBuilding,
  IconMoodSmile,
  IconBuildingArch,
  IconCandle,
  IconConfetti,
  IconPalette,
  IconColumns,
  IconShield,
  IconScale,
  IconDashboard,
  IconGraph,
  IconWorld,
  IconBuildingMonument,
  IconQrcode,
  IconMedal,
  IconInfoCircle,
  IconChevronUp,
  IconGitFork,
  IconSettings,
  IconListCheck,
  IconFingerprint,
  IconLink,
  // IconBrain, // re-import when the sidebar AI Pipeline entry is restored below
  IconFolders,
  IconBriefcase,
} from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';

// import { useSidebar } from '@/components/ui/sidebar';
// import { NavDocuments } from '@/components/nav-documents';
import { NavMain } from '@/components/nav-main';
import { NavKnowledgebase } from '@/components/nav-knowledgebase';
// import { NavSecondary } from '@/components/nav-secondary';
// import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

import { apiFetchJson } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import { apiUserInfoPath } from '@/lib/api-paths';
import { useOntology } from "@/lib/ontology";

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
        }>(apiUserInfoPath(), {
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
      const iconMap: Record<string, Icon> = {
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
          navtitle={t('describe')}
          items={[
            { title: t('dashboard'), url: '/', icon: IconLayoutDashboard },
            { title: t('graphVisualization'), url: '/graphview', icon: IconGraph },
            { title: t('heritageAtlas'), url: '/atlas', icon: IconWorld },
            { title: t('heritageMuseum'), url: '/heritage-museum', icon: IconBuildingMonument },
            ...(showAuthedNav
              ? [{ title: t('progression'), url: '/progression', icon: IconMedal }]
              : []),
            { title: t('leaderboard'), url: '/leaderboard', icon: IconTrophy },
          ]}
        />

        <NavKnowledgebase
          sectionTitle={t('browseByType')}
          hubTitle={t('knowledgeHub')}
          hubUrl="/knowledge/entity"
          hubIcon={IconBuildingCommunity}
          browseLabel={t('browseByType')}
          items={knowledgeBrowseItems}
        />

        <NavMain
          navtitle={t('record')}
          items={[
            { title: t('contribute'), url: '/contribute', icon: IconPlus },
            ...(showAuthedNav
              ? [
                  {
                    title: 'My Projects',
                    url: '/contribute/projects',
                    icon: IconFolders,
                  },
                  {
                    title: 'Entity proposal',
                    url: '/contribute/entity-proposal',
                    icon: IconFingerprint,
                  },
                  {
                    title: 'Relationship proposal',
                    url: '/contribute/relationship-proposal',
                    icon: IconLink,
                  },
                  // ────────────────────────────────────────────────────────
                  // AI Pipeline — part of the agentic pipeline.
                  // Hidden from the sidebar for now; the /contribute/pipeline
                  // route still exists. Re-enable when the pipeline UX is ready.
                  // ────────────────────────────────────────────────────────
                  // {
                  //   title: t('aiPipeline'),
                  //   url: '/contribute/pipeline',
                  //   icon: IconBrain,
                  // },
                ]
              : []),
            { title: t('qrContributions'), url: '/curation/qr-contributions', icon: IconQrcode },
          ]}
        />

        <NavMain navtitle={t('claim')} items={[
          ...(isReviewer ? [
            { title: t('identityQueue'), url: '/curation/identity', icon: IconGitFork },
            { title: t('conflicts'), url: '/curation/conflicts', icon: IconScale },
            { title: t('truthClaims'), url: '/knowledge/assertion', icon: IconShield },
          ] : []),
        ]} />

        <NavMain navtitle={t('verify')} items={[
          ...(isModerator ? [{ title: t('reviewerDashboard'), url: '/curation/dashboard', icon: IconDashboard }] : []),
          ...(isReviewer ? [
            { title: t('reviewQueue'), url: '/curation/review', icon: IconShield },
            {
              title: 'Project dossiers',
              url: '/curation/projects-review',
              icon: IconBriefcase,
            },
            { title: t('reviewWorkspace'), url: '/review', icon: IconListCheck },
          ] : []),
          ...(isModerator
            ? [{ title: 'KG proposals', url: '/curation/kg-proposals', icon: IconLink }]
            : []),
          { title: t('contributionsQueue'), url: '/curation/contributions', icon: IconFileDescription },
          { title: t('activityLog'), url: '/curation/activity', icon: IconChartBar },
        ]} />

        <NavMain navtitle={t('community')} items={[
          { title: t('contributors'), url: '/community/contributors', icon: IconUsers },
          { title: t('organizations'), url: '/community/organizations', icon: IconBuilding },
          { title: t('team'), url: '/team', icon: IconUsersGroup },
          { title: t('about'), url: '/about', icon: IconInfoCircle },
          ...(showAuthedNav
            ? [{ title: t('notifications'), url: '/notification', icon: IconBell }]
            : []),
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
