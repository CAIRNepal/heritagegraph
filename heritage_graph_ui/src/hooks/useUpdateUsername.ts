"use client";

import { useSession } from "next-auth/react";

export function useUpdateUsername() {
  const { data: session, update } = useSession();

  const updateUsername = async (newUsername: string) => {
    if (!session?.accessToken) {
      throw new Error("Not authenticated");
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/user/username/`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ username: newUsername }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.username?.[0] || "Failed to update username");
    }

    // Refresh NextAuth session so stale username is replaced
    await update();
  };

  return { updateUsername };
}

