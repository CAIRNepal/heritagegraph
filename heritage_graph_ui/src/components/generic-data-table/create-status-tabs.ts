import type { DataTableTab } from './types';

function normalizeStatus(s?: string | null): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '_');
}

/**
 * Standard workflow tabs for knowledge tables: All / Pending / Approved / Rejected.
 * Matches backend enums like `pending_review`, `draft`, `accepted`, `rejected`.
 */
/** Query params for server-side list APIs (`ContributionFlowMixin` / `list_visibility`). */
export function statusQueryParamsForTab(
  tabId: string
): Record<string, string> {
  switch (tabId) {
    case 'pending':
      return { status: 'pending_review' };
    case 'rejected':
      return { status: 'rejected' };
    case 'approved':
      return {};
    case 'all':
      return { all: '1' };
    default:
      return {};
  }
}

export function createStatusWorkflowTabs<
  T extends { status?: string | null },
>(): DataTableTab<T>[] {
  return [
    { id: 'all', label: 'All' },
    {
      id: 'pending',
      label: 'Pending',
      filter: (row) => {
        const s = normalizeStatus(row.status);
        return (
          s.includes('pending') ||
          s === 'draft' ||
          s === 'pending_revision'
        );
      },
    },
    {
      id: 'approved',
      label: 'Approved',
      filter: (row) => {
        const s = normalizeStatus(row.status);
        return (
          s === 'accepted' ||
          s === 'published' ||
          s === 'approved' ||
          s === 'merged'
        );
      },
    },
    {
      id: 'rejected',
      label: 'Rejected',
      filter: (row) => normalizeStatus(row.status) === 'rejected',
    },
  ];
}
