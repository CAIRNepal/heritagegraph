"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
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
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  comment: {
    label: "Comment",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  },
  moderation: {
    label: "Review",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  review_decision: {
    label: "Decision",
    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  },
  revision: {
    label: "Revision",
    className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  },
  reaction: {
    label: "Reaction",
    className: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  },
  fork: {
    label: "Fork",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  },
  general: {
    label: "General",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  },
};

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
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const badge = typeBadgeMap[notification.notification_type] || typeBadgeMap.general;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-left p-3 rounded-lg transition-colors duration-200 border-b last:border-0",
        notification.is_read
          ? "opacity-60 hover:opacity-80"
          : "bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {notification.message}
          </p>
          {notification.entity_name && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {notification.entity_name}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", badge.className)}>
              {badge.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
          </div>
        </div>
        {!notification.is_read && (
          <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
        )}
      </div>
    </button>
  );
}

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const router = useRouter();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] p-0 overflow-hidden"
        sideOffset={8}
        collisionPadding={12}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => markAllAsRead()}
              >
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => router.push("/dashboard/notification")}
            >
              View all
            </Button>
          </div>
        </div>

        <div className="overflow-hidden max-h-80">
          <ScrollArea className="h-full max-h-80">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              <div className="p-1">
                {notifications.slice(0, 10).map((n) => (
                  <NotificationItem
                    key={n.notification_id}
                    notification={n}
                    onRead={(id) => markAsRead([id])}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {notifications.length > 10 && (
          <div className="p-2 border-t text-center">
            <Button
              variant="link"
              size="sm"
              className="text-xs"
              onClick={() => router.push("/dashboard/notification")}
            >
              See all {notifications.length} notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
