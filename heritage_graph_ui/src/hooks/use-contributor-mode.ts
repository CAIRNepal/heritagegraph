"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";

export type ContributorMode = "basic" | "advanced";

type ProfileMePayload = {
  slug?: string;
  contributor_mode?: ContributorMode;
};

export function useContributorMode() {
  const { data: session, status } = useSession();
  const [slug, setSlug] = useState<string | null>(null);
  const [mode, setMode] = useState<ContributorMode>("basic");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status !== "authenticated" || !session?.accessToken) {
      setIsLoading(false);
      return;
    }

    const api = getPublicApiUrl();
    if (!api) {
      setIsLoading(false);
      setError("API is not configured. Set NEXT_PUBLIC_API_URL and reload.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await apiFetchJson<ProfileMePayload>(`${api}/data/api/user/me/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
      setSlug(data.slug || null);
      setMode(data.contributor_mode === "advanced" ? "advanced" : "basic");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load contributor mode."));
    } finally {
      setIsLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateMode = useCallback(
    async (next: ContributorMode) => {
      if (next === mode) return true;
      if (status !== "authenticated" || !session?.accessToken) return false;
      const api = getPublicApiUrl();
      if (!api) return false;

      try {
        setIsSaving(true);
        setError(null);

        let targetSlug = slug;
        if (!targetSlug) {
          const me = await apiFetchJson<ProfileMePayload>(`${api}/data/api/user/me/`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.accessToken}`,
            },
          });
          targetSlug = me.slug || null;
          setSlug(targetSlug);
        }

        if (!targetSlug) {
          setError("Could not resolve profile id for mode update.");
          return false;
        }

        const updated = await apiFetchJson<ProfileMePayload>(
          `${api}/data/api/user/${encodeURIComponent(targetSlug)}/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.accessToken}`,
            },
            body: JSON.stringify({ contributor_mode: next }),
          }
        );

        setMode(updated.contributor_mode === "advanced" ? "advanced" : next);
        return true;
      } catch (err) {
        setError(getApiErrorMessage(err, "Could not save contributor mode."));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [mode, session, slug, status]
  );

  return {
    mode,
    isLoading,
    isSaving,
    error,
    setMode: updateMode,
    refetch: load,
  };
}
