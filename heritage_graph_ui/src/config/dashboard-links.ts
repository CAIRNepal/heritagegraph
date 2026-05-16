import type { ComponentType } from "react";
import type { IconProps } from "@tabler/icons-react";
import {
  IconPlus,
  IconGraph,
  IconWorld,
  IconMedal,
  IconBooks,
  IconBuildingCommunity,
  IconUser,
  IconMapPin,
  IconCalendarEvent,
  IconUsers,
  IconFileDescription,
  IconChartBar,
  IconShield,
  IconPhotoScan,
} from "@tabler/icons-react";

export interface DashboardLinkItem {
  title: string;
  href: string;
  gradient: string;
  icon: ComponentType<IconProps>;
  desc?: string;
}

export const dashboardQuickActions: DashboardLinkItem[] = [
  {
    title: "Knowledge Graph",
    desc: "Explore the ontology graph visualization.",
    icon: IconGraph,
    href: "/graphview",
    gradient: "from-violet-500 to-blue-500",
  },
  {
    title: "Heritage Atlas",
    desc: "3D globe of heritage sites with timeline (preview).",
    icon: IconWorld,
    href: "/atlas",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    title: "New Contribution",
    desc: "Submit a cultural heritage entry.",
    icon: IconPlus,
    href: "/contribute",
    gradient: "from-blue-500 to-sky-500",
  },
  {
    title: "Document ingestion (OCR)",
    desc: "Bulk-upload PDFs or scans, review OCR, then merge into contribute forms.",
    icon: IconPhotoScan,
    href: "/contribute/ingestion",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    title: "Knowledge Base",
    desc: "Browse cultural entities & records.",
    icon: IconBooks,
    href: "/knowledge/entity",
    gradient: "from-blue-600 to-cyan-500",
  },
  {
    title: "Progression",
    desc: "Track your ranks, seals & achievements.",
    icon: IconMedal,
    href: "/progression",
    gradient: "from-amber-500 to-yellow-500",
  },
];

export const dashboardBrowseCategories: DashboardLinkItem[] = [
  {
    title: "Cultural Entity",
    icon: IconBuildingCommunity,
    href: "/knowledge/entity",
    gradient: "from-blue-500 to-sky-500",
  },
  {
    title: "Person",
    icon: IconUser,
    href: "/knowledge/person",
    gradient: "from-sky-500 to-cyan-500",
  },
  {
    title: "Location",
    icon: IconMapPin,
    href: "/knowledge/location",
    gradient: "from-blue-600 to-sky-600",
  },
  {
    title: "Event",
    icon: IconCalendarEvent,
    href: "/knowledge/event",
    gradient: "from-blue-600 to-cyan-500",
  },
  {
    title: "Contributors",
    icon: IconUsers,
    href: "/community/contributors",
    gradient: "from-sky-500 to-blue-600",
  },
];

export const dashboardCurationShortcuts: DashboardLinkItem[] = [
  {
    title: "Contributions Queue",
    desc: "Pending community submissions awaiting review.",
    icon: IconFileDescription,
    href: "/curation/contributions",
    gradient: "from-blue-400 to-sky-500",
  },
  {
    title: "Activity Log",
    desc: "Track recent changes and platform activity.",
    icon: IconChartBar,
    href: "/curation/activity",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    title: "Reviewer Dashboard",
    desc: "Your review stats, decisions, and metrics.",
    icon: IconShield,
    href: "/curation/dashboard",
    gradient: "from-sky-500 to-blue-600",
  },
];

