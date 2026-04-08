'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getPublicApiUrl } from '@/lib/api-base';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 20;

export interface PlatformAdminUserRow {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  groups: string[];
  reviewer_role: { id: string; role: string; is_active: boolean } | null;
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function formatRole(role: string, t: ReturnType<typeof useTranslations<'platformAdmin'>>): string {
  if (role === 'community_reviewer') return t('roleCommunity');
  if (role === 'domain_expert') return t('roleDomain');
  if (role === 'expert_curator') return t('roleCurator');
  return role;
}

export default function PlatformAdminUsersPage() {
  const { data: session, status } = useSession();
  const t = useTranslations('platformAdmin');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Paginated<PlatformAdminUserRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setOffset(0);
    }, 320);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        ordering: '-date_joined',
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(
        `${getPublicApiUrl()}/data/api/platform-admin/users/?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) {
        setError(t('loadError'));
        setData(null);
        return;
      }
      const json = (await res.json()) as Paginated<PlatformAdminUserRow>;
      setData(json);
    } catch {
      setError(t('loadError'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, status, offset, debouncedSearch, t]);

  useEffect(() => {
    load();
  }, [load]);

  const from = data && data.results.length ? offset + 1 : 0;
  const to = data ? offset + data.results.length : 0;
  const total = data?.count ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{tNav('platformAdmin')}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t('usersTitle')}</h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          aria-label={t('searchPlaceholder')}
        />
        <div className="text-xs text-muted-foreground">
          {data ? t('pageStatus', { from, to, total }) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tNav('platformAdminUsers')}</TableHead>
              <TableHead>{t('groups')}</TableHead>
              <TableHead>{t('reviewerRole')}</TableHead>
              <TableHead className="w-[120px]">{t('dateJoined')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  {tCommon('loading')}
                </TableCell>
              </TableRow>
            ) : !data?.results.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  {t('noUsers')}
                </TableCell>
              </TableRow>
            ) : (
              data.results.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link
                      href={`/platform-admin/users/${u.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {u.username || u.email}
                    </Link>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {u.is_staff ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {t('staffBadge')}
                        </Badge>
                      ) : null}
                      {u.is_superuser ? (
                        <Badge variant="outline" className="text-[10px]">
                          {t('superuserBadge')}
                        </Badge>
                      ) : null}
                      {!u.is_active ? (
                        <Badge variant="destructive" className="text-[10px]">
                          {t('inactiveBadge')}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                    {u.groups.length ? u.groups.join(', ') : t('none')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.reviewer_role?.is_active ? (
                      <span>{formatRole(u.reviewer_role.role, t)}</span>
                    ) : (
                      t('none')
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {u.date_joined
                      ? new Date(u.date_joined).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : t('none')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.count > PAGE_SIZE ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!data.previous || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            {t('prev')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.next || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            {t('next')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
