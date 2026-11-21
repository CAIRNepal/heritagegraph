import type { ComponentType } from "react";
import type { IconProps } from "@tabler/icons-react";
import {
  IconBuildingCommunity,
  IconUser,
  IconMapPin,
  IconCalendarEvent,
  IconUsers,
} from "@tabler/icons-react";

/**
 * A tile in a ShortcutGrid.
 *
 * `titleKey` is a next-intl message key, not a display string: these tiles used
 * to hardcode English, which left the Nepali UI half-translated.
 */
export interface DashboardLinkItem {
  /** Message key under the namespace the consuming grid is given. */
  titleKey: string;
  /** Optional message key for the supporting line. */
  descKey?: string;
  href: string;
  icon: ComponentType<IconProps>;
}

/**
 * Compact browse row on the dashboard.
 *
 * The sidebar already enumerates every registry domain, so this is a short
 * shortcut row rather than a second navigation surface. Quick-action and
 * curation grids used to live here too and were removed: they duplicated the
 * sidebar three times over on one screen.
 */
export const dashboardBrowseCategories: DashboardLinkItem[] = [
  {
    titleKey: "culturalEntity",
    icon: IconBuildingCommunity,
    href: "/knowledge/entity",
  },
  { titleKey: "person", icon: IconUser, href: "/knowledge/person" },
  { titleKey: "location", icon: IconMapPin, href: "/knowledge/location" },
  { titleKey: "event", icon: IconCalendarEvent, href: "/knowledge/event" },
  { titleKey: "contributors", icon: IconUsers, href: "/community/contributors" },
];
