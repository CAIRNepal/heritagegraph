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

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationIds?: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const getHeaders = useCallback(() => {
    const token = (sessionRef.current as any)?.accessToken;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!sessionRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/data/api/notifications/`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      setNotifications(data.results || data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  const fetchUnreadCount = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/data/api/notifications/unread_count/`,
        { headers: getHeaders() }
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
          }
        );
        if (res.ok) {
          if (notificationIds) {
            setNotifications((prev) =>
              prev.map((n) =>
                notificationIds.includes(n.notification_id)
                  ? { ...n, is_read: true }
                  : n
              )
            );
            setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));
          } else {
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
          }
        }
      } catch {
        // ignore
      }
    },
    [getHeaders]
  );

  const markAllAsRead = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/data/api/notifications/mark_all_read/`,
        { method: "POST", headers: getHeaders() }
      );
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch {
      // ignore
    }
  }, [getHeaders]);

  // Initial fetch when session becomes available
  useEffect(() => {
    if (session) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch on every route change so new notifications appear immediately
  useEffect(() => {
    if (session && pathname) {
      fetchUnreadCount();
      fetchNotifications();
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for unread count every 30 seconds
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
    loading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
  };
}
