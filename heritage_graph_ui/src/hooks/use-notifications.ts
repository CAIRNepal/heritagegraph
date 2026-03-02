"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const token = (session as any)?.accessToken;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [session]);

  const fetchNotifications = useCallback(async () => {
    if (!session) return;
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
  }, [session, getHeaders]);

  const fetchUnreadCount = useCallback(async () => {
    if (!session) return;
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
  }, [session, getHeaders]);

  const markAsRead = useCallback(
    async (notificationIds?: string[]) => {
      if (!session) return;
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
          // Update local state
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
    [session, getHeaders]
  );

  const markAllAsRead = useCallback(async () => {
    if (!session) return;
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
  }, [session, getHeaders]);

  // Auto-fetch on session change
  useEffect(() => {
    if (session) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [session, fetchNotifications, fetchUnreadCount]);

  // Poll for unread count every 30 seconds
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [session, fetchUnreadCount]);

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
