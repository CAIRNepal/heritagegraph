import { useSession } from "next-auth/react";

import { apiFetchJson } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";

const API_BASE = getPublicApiUrl();

export function useUpdateUsername() {
  const { data: session, update } = useSession();

  const updateUsername = async (newUsername: string) => {
    if (!session?.accessToken) {
      throw new Error("Sign in to update your username.");
    }
    if (!API_BASE) {
      throw new Error("API is not configured. Set NEXT_PUBLIC_API_URL and reload.");
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

