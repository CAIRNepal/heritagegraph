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
  IconAlertTriangle,
  IconFolders,
  IconBriefcase,
  IconClipboardList,
  IconDatabase,
  IconSearch,
  IconFlask,
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
        // Roles stay false, which silently downgrades a reviewer to no
        // permissions -- log it so the cause is diagnosable.
        console.error('Failed to load sidebar roles', err);
      }
    })();
  }, [session, status]);

  return roles;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
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
              className="sticky top-1 z-20 mx-auto flex items-center gap-1 rounded-full bg-primary/90 px-3 py-1 text-[11px] font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary hover:shadow-md"
            >
              <IconChevronUp className="size-3.5" />
              {!isCollapsed && <span>{tCommon('scrollToTop')}</span>}
            </button>
          </>
        )}

        {/* ── 1. Explore ── the heritage itself, first ── */}
        <NavMain
          navtitle={t('explore')}
          items={[
            { title: t('heritageMuseum'), url: '/heritage-museum', icon: IconBuildingMonument },
            { title: t('heritageAtlas'), url: '/atlas', icon: IconWorld },
            { title: t('graphVisualization'), url: '/graphview', icon: IconGraph },
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

        {/* ── 2. Dashboard ── numbers, for the audience that wants them ── */}
        <NavMain
          navtitle={t('dashboardGroup')}
          items={[
            { title: t('dashboard'), url: '/dashboard', icon: IconLayoutDashboard },
            ...(showAuthedNav
              ? [{ title: t('progression'), url: '/progression', icon: IconMedal }]
              : []),
            { title: t('leaderboard'), url: '/leaderboard', icon: IconTrophy },
          ]}
        />

        <NavMain
          navtitle={t('record')}
          items={[
            { title: t('contribute'), url: '/contribute', icon: IconPlus },
            ...(showAuthedNav
              ? [
                  {
                    title: t('mySubmissions'),
                    url: '/contribute/my-contributions',
                    icon: IconClipboardList,
                  },
                  {
                    title: t('updateExisting'),
                    url: '/contribute/improve',
                    icon: IconSearch,
                  },
                  {
                    title: t('myProjects'),
                    url: '/contribute/projects',
                    icon: IconFolders,
                  },
                  {
                    title: t('evidenceSources'),
                    url: '/contribute/data-source',
                    icon: IconDatabase,
                  },
                  {
                    title: t('entityProposal'),
                    url: '/contribute/entity-proposal',
                    icon: IconFingerprint,
                  },
                  {
                    title: t('relationshipProposal'),
                    url: '/contribute/relationship-proposal',
                    icon: IconLink,
                  },
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
              title: t('projectDossiers'),
              url: '/curation/projects-review',
              icon: IconBriefcase,
            },
            { title: t('reviewWorkspace'), url: '/review', icon: IconListCheck },
            { title: t('mergeRequests'), url: '/review/merge-requests', icon: IconGitFork },
          ] : []),
          ...(isModerator
            ? [{ title: t('kgProposals'), url: '/curation/kg-proposals', icon: IconLink }]
            : []),
          ...(isReviewer
            ? [{ title: t('staleLinks'), url: '/curation/stale-links', icon: IconAlertTriangle }]
            : []),
          { title: t('contributionsQueue'), url: '/curation/contributions', icon: IconFileDescription },
          { title: t('activityLog'), url: '/curation/activity', icon: IconChartBar },
        ]} />

        {/* ── 4. Reference ── low emphasis, at the bottom. About and Methods
             stay complete and reachable — /methods matters to reviewers and to
             anyone reusing the data — they just stop competing with the
             heritage for attention. ── */}
        <NavMain navtitle={t('reference')} items={[
          { title: t('about'), url: '/about', icon: IconInfoCircle },
          { title: t('methods'), url: '/methods', icon: IconFlask },
          { title: t('team'), url: '/team', icon: IconUsersGroup },
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
