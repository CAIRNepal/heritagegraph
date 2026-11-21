'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useSession } from 'next-auth/react';

import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { apiUserInfoPath } from '@/lib/api-paths';
import { getPublicApiUrl } from '@/lib/api-base';

const API_BASE = getPublicApiUrl();

export interface ReviewerRoleInfo {
  role: 'community_reviewer' | 'domain_expert' | 'expert_curator';
  is_active: boolean;
  can_override_confidence: boolean;
  can_resolve_conflicts: boolean;
  can_manage_roles: boolean;
}

export interface ReviewerApplicationInfo {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  created_at: string;
}

export interface UserRoles {
  groups: string[];
  isStaff: boolean;
  reviewerRole: ReviewerRoleInfo | null;
  /** Latest reviewer application, if any (for apply-to-review flow). */
  reviewerApplication: ReviewerApplicationInfo | null;
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
  reviewerApplication: null,
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
  const [reviewerApplication, setReviewerApplication] = useState<ReviewerApplicationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    if (status !== 'authenticated' || !session?.accessToken) {
      setIsLoading(false);
      setReviewerApplication(null);
      return;
    }
    if (!API_BASE) {
      setIsLoading(false);
      setError('API is not configured. Set NEXT_PUBLIC_API_URL and reload.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await apiFetchJson<{
        groups?: string[];
        is_staff?: boolean;
        reviewer_role?: ReviewerRoleInfo | null;
        reviewer_application?: {
          id: string;
          status: 'pending' | 'approved' | 'rejected';
          message: string;
          created_at: string;
        } | null;
      }>(apiUserInfoPath(), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
      setGroups(data.groups || []);
      setIsStaff(data.is_staff || false);
      setReviewerRole(data.reviewer_role || null);
      setReviewerApplication(data.reviewer_application || null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your account permissions.'));
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
    reviewerApplication,
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
