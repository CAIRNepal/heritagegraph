"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Notification {
  notification_id: string;
  user: number;
  notification_type: string;
  message: string;
  is_read: boolean;
  link: string;
  entity_name: string | null;
  entity_id: string | null;
  entity_category: string | null;
  actor_username: string | null;
  actor_display_name: string | null;
  submission: string | null;
  created_at: string;
}

interface UseNotificationsOptions {
  pageSize?: number;
  autoFetch?: boolean;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  fetchNotifications: (params?: {
    limit?: number;
    offset?: number;
    filters?: Record<string, string>;
    append?: boolean;
  }) => Promise<void>;
  fetchPage: (page: number, filters?: Record<string, string>) => Promise<void>;
  loadMore: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationIds?: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(
  options?: UseNotificationsOptions,
): UseNotificationsReturn {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const pageSize = options?.pageSize ?? 20;
  const autoFetch = options?.autoFetch ?? true;

  const getHeaders = useCallback(() => {
    const token = (sessionRef.current as any)?.accessToken;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const fetchNotifications = useCallback(
    async (params?: {
      limit?: number;
      offset?: number;
      filters?: Record<string, string>;
      append?: boolean;
    }) => {
      if (!sessionRef.current) return;
      const isAppend = params?.append ?? false;
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const limit = params?.limit ?? pageSize;
        const offset = params?.offset ?? 0;
        const searchParams = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
        });
        if (params?.filters) {
          for (const [key, value] of Object.entries(params.filters)) {
            if (value) searchParams.set(key, value);
          }
        }
        const res = await fetch(
          `${API_BASE_URL}/data/api/notifications/?${searchParams}`,
          { headers: getHeaders() },
        );
        if (!res.ok) throw new Error("Failed to fetch notifications");
        const data = await res.json();
        const results: Notification[] =
          data.results ?? (Array.isArray(data) ? data : []);
        const count = data.count ?? results.length;

        if (isAppend) {
          setNotifications((prev) => [...prev, ...results]);
        } else {
          setNotifications(results);
        }
        setTotalCount(count);
        setHasMore(offset + results.length < count);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [getHeaders, pageSize],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    await fetchNotifications({
      limit: pageSize,
      offset: notifications.length,
      append: true,
    });
  }, [hasMore, loadingMore, notifications.length, fetchNotifications, pageSize]);

  const fetchPage = useCallback(
    async (page: number, filters?: Record<string, string>) => {
      await fetchNotifications({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        filters,
      });
    },
    [fetchNotifications, pageSize],
  );

  const fetchUnreadCount = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/data/api/notifications/unread_count/`,
        { headers: getHeaders() },
      );
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count);
      }
    } catch {
      // silently fail for count
    }
  }, [getHeaders]);

  const markAsRead = useCallback(
    async (notificationIds?: string[]) => {
      if (!sessionRef.current) return;
      try {
        const res = await fetch(
          `${API_BASE_URL}/data/api/notifications/mark_read/`,
          {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
              notification_ids: notificationIds || [],
            }),
          },
        );
        if (res.ok) {
          if (notificationIds) {
            setNotifications((prev) =>
              prev.map((n) =>
                notificationIds.includes(n.notification_id)
                  ? { ...n, is_read: true }
                  : n,
              ),
            );
            setUnreadCount((prev) =>
              Math.max(0, prev - notificationIds.length),
            );
          } else {
            setNotifications((prev) =>
              prev.map((n) => ({ ...n, is_read: true })),
            );
            setUnreadCount(0);
          }
        }
      } catch {
        // ignore
      }
    },
    [getHeaders],
  );

  const markAllAsRead = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/data/api/notifications/mark_all_read/`,
        { method: "POST", headers: getHeaders() },
      );
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true })),
        );
        setUnreadCount(0);
      }
    } catch {
      // ignore
    }
  }, [getHeaders]);

  useEffect(() => {
    if (!session) return;
    fetchUnreadCount();
    if (autoFetch) fetchNotifications();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session || !pathname) return;
    fetchUnreadCount();
    if (autoFetch) fetchNotifications();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30_000);
    return () => clearInterval(interval);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    notifications,
    unreadCount,
    totalCount,
    hasMore,
    loading,
    loadingMore,
    error,
    fetchNotifications,
    fetchPage,
    loadMore,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
  };
}
