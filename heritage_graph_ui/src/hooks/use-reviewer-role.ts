'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

import { apiFetchJson, ApiError, getApiErrorMessage } from '@/lib/api-client';
import { dataApiPath } from '@/lib/api-paths';
import { getPublicApiUrl } from '@/lib/api-base';

export interface ReviewerRole {
  id: string;
  user: { id: number; username: string; email: string; first_name: string; last_name: string };
  role: 'community_reviewer' | 'domain_expert' | 'expert_curator';
  expertise_areas: string[];
  is_active: boolean;
  can_override_confidence: boolean;
  can_resolve_conflicts: boolean;
  can_manage_roles: boolean;
}

interface UseReviewerRoleReturn {
  role: ReviewerRole | null;
  isLoading: boolean;
  hasAccess: boolean;
  isStaff: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to check the current user's reviewer role.
 * Returns hasAccess=true if the user has any active reviewer role or is staff.
 */
export function useReviewerRole(): UseReviewerRoleReturn {
  const { data: session, status } = useSession();
  const [role, setRole] = useState<ReviewerRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRole = useCallback(async () => {
    if (status !== 'authenticated' || !session?.accessToken) {
      setIsLoading(false);
      return;
    }
    const apiBase = getPublicApiUrl();
    if (!apiBase) {
      setIsLoading(false);
      setError('API is not configured. Set NEXT_PUBLIC_API_URL and reload.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      try {
        const data = await apiFetchJson<ReviewerRole>(
          dataApiPath('reviewer-roles', 'my_role'),
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );
        setRole(data);
        setIsStaff(false);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          setRole(null);
          setError(null);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not verify reviewer access.'));
    } finally {
      setIsLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  const hasAccess = isStaff || (role !== null && role.is_active);

  return { role, isLoading, hasAccess, isStaff, error, refetch: fetchRole };
}
