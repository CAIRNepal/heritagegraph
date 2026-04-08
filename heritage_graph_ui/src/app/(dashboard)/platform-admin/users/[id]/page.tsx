'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { getPublicApiUrl } from '@/lib/api-base';
import { useUserRoles } from '@/hooks/use-user-roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlatformAdminUserRow } from '../page';

export default function PlatformAdminUserDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { data: session, status } = useSession();
  const roles = useUserRoles();
  const t = useTranslations('platformAdmin');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');

  const [user, setUser] = useState<PlatformAdminUserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('community_reviewer');

  const canAssign = roles.isStaff || !!roles.reviewerRole?.can_manage_roles;

  const loadUser = useCallback(async () => {
    if (!id || status !== 'authenticated' || !session?.accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${getPublicApiUrl()}/data/api/platform-admin/users/${id}/`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) {
        setUser(null);
        return;
      }
      const row = (await res.json()) as PlatformAdminUserRow;
      setUser(row);
      if (row.reviewer_role?.role) {
        setSelectedRole(row.reviewer_role.role);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [id, session?.accessToken, status]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  async function submitAssign() {
    if (!user || !session?.accessToken || !canAssign) {
      toast.error(t('assignForbidden'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${getPublicApiUrl()}/data/api/reviewer-roles/assign/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          role: selectedRole,
          expertise_areas: [],
        }),
      });
      if (!res.ok) {
        toast.error(t('assignError'));
        return;
      }
      toast.success(t('assignSuccess'));
      await loadUser();
    } catch {
      toast.error(t('assignError'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">
        {tCommon('loading')}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-muted-foreground">{t('loadError')}</p>
        <Button variant="outline" asChild>
          <Link href="/platform-admin/users">{t('backToUsers')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/platform-admin/users">{t('backToUsers')}</Link>
        </Button>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">{tNav('platformAdmin')}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {user.username || user.email}
        </h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('userDetailTitle')}</CardTitle>
          <CardDescription>
            {user.first_name || user.last_name
              ? `${user.first_name} ${user.last_name}`.trim()
              : t('none')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {user.is_staff ? <Badge variant="secondary">{t('staffBadge')}</Badge> : null}
            {user.is_superuser ? <Badge variant="outline">{t('superuserBadge')}</Badge> : null}
            <Badge variant={user.is_active ? 'default' : 'destructive'}>
              {user.is_active ? t('activeBadge') : t('inactiveBadge')}
            </Badge>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t('groups')}</p>
            <p className="text-sm">{user.groups.length ? user.groups.join(', ') : t('none')}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t('reviewerRole')}</p>
            <p className="text-sm">
              {user.reviewer_role?.is_active
                ? t(
                    user.reviewer_role.role === 'domain_expert'
                      ? 'roleDomain'
                      : user.reviewer_role.role === 'expert_curator'
                        ? 'roleCurator'
                        : 'roleCommunity'
                  )
                : t('none')}
            </p>
          </div>
        </CardContent>
      </Card>

      {canAssign ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('assignRole')}</CardTitle>
            <CardDescription>{t('assignLabel')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reviewer-role">{t('assignLabel')}</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger id="reviewer-role" className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="community_reviewer">{t('roleCommunity')}</SelectItem>
                  <SelectItem value="domain_expert">{t('roleDomain')}</SelectItem>
                  <SelectItem value="expert_curator">{t('roleCurator')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={submitAssign} disabled={saving}>
              {saving ? tCommon('loading') : t('assignSubmit')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <p className="text-xs text-muted-foreground">{t('assignForbidden')}</p>
      )}
    </div>
  );
}
