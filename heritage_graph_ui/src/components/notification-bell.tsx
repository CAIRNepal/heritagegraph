"use client";

import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useNotifications,
  type Notification,
} from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const typeBadgeMap: Record<string, { label: string; className: string }> = {
  submission_update: {
    label: "Submission",
    className: "bg-muted text-foreground",
  },
  comment: {
    label: "Comment",
    className: "bg-muted text-foreground",
  },
  moderation: {
    label: "Review",
    className: "bg-muted text-foreground",
  },
  review_decision: {
    label: "Decision",
    className: "bg-muted text-foreground",
  },
  revision: {
    label: "Revision",
    className: "bg-muted text-foreground",
  },
  reaction: {
    label: "Reaction",
    className: "bg-muted text-foreground",
  },
  fork: {
    label: "Fork",
    className: "bg-muted text-foreground",
  },
  general: {
    label: "General",
    className: "bg-muted text-foreground",
  },
};

function resolveNotificationLink(notification: Notification): string {
  if (notification.link && notification.link.startsWith("/")) {
    return notification.link;
  }
  if (notification.entity_id) {
    return `/knowledge/entity/view/${notification.entity_id}`;
  }
  return "/";
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.notification_id);
    }
    router.push(resolveNotificationLink(notification));
  };

  const badge = typeBadgeMap[notification.notification_type] || typeBadgeMap.general;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });

  const actorLabel = notification.actor_display_name || notification.actor_username;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full rounded-lg border-b p-3 text-left transition-colors last:border-0",
        notification.is_read
          ? "opacity-70 hover:opacity-90"
          : "bg-primary/5 hover:bg-primary/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {actorLabel ?
            <p className="mb-0.5 truncate text-[11px] font-semibold text-primary">
              {actorLabel}
            </p>
          : null}
          <p className="truncate text-sm font-medium text-foreground">
            {notification.message}
          </p>
          {notification.entity_name ?
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {notification.entity_name}
            </p>
          : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={cn("px-1.5 py-0 text-[10px]", badge.className)}>
              {badge.label}
            </Badge>
            {notification.entity_category ?
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] capitalize">
                {notification.entity_category}
              </Badge>
            : null}
            <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
          </div>
        </div>
        {!notification.is_read ?
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
        : null}
      </div>
    </button>
  );
}

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    totalCount,
    hasMore,
    loading,
    loadingMore,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications({ pageSize: 15 });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative overflow-visible">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ?
            <span className="pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden p-0"
        sideOffset={8}
        collisionPadding={12}
      >
        <div className="flex items-center justify-between border-b p-3">
          <div>
            <h3 className="text-sm font-semibold">Notifications</h3>
            {totalCount > 0 ?
              <p className="text-[11px] text-muted-foreground">{totalCount} total</p>
            : null}
          </div>
          {unreadCount > 0 ?
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllAsRead()}
            >
              Mark all read
            </Button>
          : null}
        </div>

        <ScrollArea className="max-h-[min(28rem,70vh)]">
          {loading && notifications.length === 0 ?
            <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
          : notifications.length === 0 ?
            <div className="p-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          : (
            <div className="p-1">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.notification_id}
                  notification={n}
                  onRead={(id) => markAsRead([id])}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {hasMore ?
          <div className="border-t px-2 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ?
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Loading...
                </>
              : "Load more"}
            </Button>
          </div>
        : null}
      </PopoverContent>
    </Popover>
  );
}
