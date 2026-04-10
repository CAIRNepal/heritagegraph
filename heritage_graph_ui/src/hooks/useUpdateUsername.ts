import { useSession } from "next-auth/react";

import { apiFetchJson } from "@/lib/api-client";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useUpdateUsername() {
  const { data: session, update } = useSession();

  const updateUsername = async (newUsername: string) => {
    if (!session?.accessToken) {
      throw new Error("Sign in to update your username.");
    }

    await apiFetchJson(`${API_BASE}/user/username/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ username: newUsername }),
    });

    await update();
  };

  return { updateUsername };
}

