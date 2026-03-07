'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/data/api/reviewer-roles/my_role/`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      if (res.ok) {
        const data: ReviewerRole = await res.json();
        setRole(data);
        setIsStaff(false);
      } else if (res.status === 404) {
        // No reviewer role assigned — check if user is staff via a
        // lightweight endpoint. For now, treat 404 as no access.
        setRole(null);
      } else if (res.status === 403) {
        setRole(null);
      } else {
        setError(`Failed to check role (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check reviewer role');
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
