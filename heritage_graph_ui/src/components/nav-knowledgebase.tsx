'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconChevronDown } from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export interface KnowledgeNavItem {
  title: string;
  url: string;
  icon?: Icon;
}

export function NavKnowledgebase({
  sectionTitle,
  hubTitle,
  hubUrl,
  hubIcon: HubIcon,
  browseLabel,
  items,
}: {
  sectionTitle: string;
  hubTitle: string;
  hubUrl: string;
  hubIcon?: Icon;
  browseLabel: string;
  items: KnowledgeNavItem[];
}) {
  const pathname = usePathname();
  const { state, setOpen: setSidebarOpen, isMobile, setOpenMobile } = useSidebar();
  const [open, setOpen] = React.useState(false);
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const hubActive = pathname === hubUrl;

  React.useEffect(() => {
    const inNested = itemsRef.current.some(
      (item) => pathname === item.url || pathname.startsWith(`${item.url}/`),
    );
    if (inNested) {
      setOpen(true);
    }
  }, [pathname]);

  const toggleBrowse = () => {
    // Icon-collapsed sidebars clip overflow — expand the rail first so the menu can open.
    if (state === 'collapsed') {
      if (isMobile) setOpenMobile(true);
      else setSidebarOpen(true);
      setOpen(true);
      return;
    }
    setOpen((o) => !o);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
        {sectionTitle}
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={hubTitle} isActive={hubActive}>
              <Link
                href={hubUrl}
                className="flex w-full items-center gap-2.5 rounded-lg text-sm transition-all duration-200 hover:translate-x-0.5"
              >
                {HubIcon ? (
                  <HubIcon
                    className={cn(
                      'size-[18px] shrink-0 transition-colors duration-200',
                      hubActive ? 'text-sidebar-primary' : '',
                    )}
                  />
                ) : null}
                <span
                  className={
                    hubActive ? 'font-medium text-sidebar-foreground' : ''
                  }
                >
                  {hubTitle}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              onClick={toggleBrowse}
              aria-expanded={open}
              className="flex w-full cursor-pointer items-center gap-2.5 text-sm"
            >
              <IconChevronDown
                className={cn(
                  'size-[18px] shrink-0 text-muted-foreground transition-transform',
                  open && 'rotate-180',
                )}
              />
              <span className="text-muted-foreground">{browseLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {open
            ? items.map((item) => {
                const isActive =
                  pathname === item.url || pathname.startsWith(`${item.url}/`);
                const ItemIcon = item.icon;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                      <Link
                        href={item.url}
                        className="ml-1 flex w-full items-center gap-2.5 border-l border-border/60 pl-3 text-sm transition-all duration-200 hover:translate-x-0.5"
                      >
                        {ItemIcon ? (
                          <ItemIcon
                            className={cn(
                              'size-[16px] shrink-0 transition-colors duration-200',
                              isActive ? 'text-sidebar-primary' : '',
                            )}
                          />
                        ) : null}
                        <span
                          className={
                            isActive ? 'font-medium text-sidebar-foreground' : ''
                          }
                        >
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })
            : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
