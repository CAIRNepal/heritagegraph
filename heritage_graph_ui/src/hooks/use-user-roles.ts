'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useSession } from 'next-auth/react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ReviewerRoleInfo {
  role: 'community_reviewer' | 'domain_expert' | 'expert_curator';
  is_active: boolean;
  can_override_confidence: boolean;
  can_resolve_conflicts: boolean;
  can_manage_roles: boolean;
}

export interface UserRoles {
  groups: string[];
  isStaff: boolean;
  reviewerRole: ReviewerRoleInfo | null;
  isModerator: boolean;
  isReviewer: boolean;
  isContributor: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const defaultRoles: UserRoles = {
  groups: [],
  isStaff: false,
  reviewerRole: null,
  isModerator: false,
  isReviewer: false,
  isContributor: false,
  isLoading: true,
  error: null,
  refetch: async () => {},
};

export const UserRolesContext = createContext<UserRoles>(defaultRoles);

export function useUserRolesProvider(): UserRoles {
  const { data: session, status } = useSession();
  const [groups, setGroups] = useState<string[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [reviewerRole, setReviewerRole] = useState<ReviewerRoleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    if (status !== 'authenticated' || !session?.accessToken) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/api/user/info`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
        setIsStaff(data.is_staff || false);
        setReviewerRole(data.reviewer_role || null);
      } else {
        setError(`Failed to fetch roles (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user roles');
    } finally {
      setIsLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const isModerator = isStaff || groups.includes('Moderators');
  const isReviewer = isModerator || groups.includes('Reviewers') || (reviewerRole?.is_active ?? false);
  const isContributor = isReviewer || groups.includes('Contributors');

  return {
    groups,
    isStaff,
    reviewerRole,
    isModerator,
    isReviewer,
    isContributor,
    isLoading,
    error,
    refetch: fetchRoles,
  };
}

export function useUserRoles(): UserRoles {
  return useContext(UserRolesContext);
}
