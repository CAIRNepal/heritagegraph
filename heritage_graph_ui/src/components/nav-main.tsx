'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type Icon } from '@tabler/icons-react';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';

export function NavMain({
  items,
  navtitle,
}: {
  navtitle: string;
  items: {
    title: string;
    url: string;
    icon?: Icon;
  }[];
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-1">
        <SidebarMenu>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-blue-500/70 dark:text-blue-400/70">
            {navtitle}
          </SidebarGroupLabel>

          {items.map((item) => {
            const isActive = pathname === item.url || pathname.startsWith(item.url + '/');
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                  <Link
                    href={item.url}
                    className="flex items-center gap-2.5 w-full text-sm rounded-lg transition-all duration-200 hover:translate-x-0.5"
                  >
                    {item.icon && (
                      <item.icon
                        className={`size-[18px] shrink-0 transition-colors duration-200 ${
                          isActive ? 'text-blue-600 dark:text-blue-400' : ''
                        }`}
                      />
                    )}
                    <span className={isActive ? 'font-medium text-blue-900 dark:text-blue-100' : ''}>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
