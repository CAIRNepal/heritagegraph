'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import { useUserRoles } from '@/hooks/use-user-roles';

interface ProposalRow {
  id: string;
  title: string;
  status: string;
  author_username?: string;
  created_at: string;
}

export default function SchemaExtensionsListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isReviewer } = useUserRoles();
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const api = getPublicApiUrl();

  const headers = useCallback((): HeadersInit => {
    const token = (session as Record<string, unknown>)?.accessToken as string | undefined;
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [session]);

  const load = useCallback(async () => {
    if (!api) return;
    try {
      setLoading(true);
      const data = await apiFetchJson<
        ProposalRow[] | { results?: ProposalRow[] }
      >(`${api}/data/api/schema-extension-proposals/`, { headers: headers() });
      setRows(
        Array.isArray(data)
          ? data
          : (data as { results?: ProposalRow[] }).results ?? [],
      );
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not load proposals.'));
    } finally {
      setLoading(false);
    }
  }, [api, headers]);

  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [status, load]);

  if (status === 'loading' || !session) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isReviewer) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Sign in as a reviewer or contributor with access to view proposals.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schema extension proposals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Draft LinkML/registry overlays; moderators approve and publish to the extension path.
          </p>
        </div>
        <Button onClick={() => router.push('/curation/schema-extensions/new')}>
          <Plus className="h-4 w-4 mr-1" /> New draft
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your proposals &amp; queue</CardTitle>
          <CardDescription>Moderators see all submitted items; others see their own drafts and submissions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No proposals yet.</p>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.id} className="py-3 flex justify-between gap-2">
                  <button
                    type="button"
                    className="text-left font-medium hover:underline"
                    onClick={() => router.push(`/curation/schema-extensions/${r.id}`)}
                  >
                    {r.title}
                  </button>
                  <Badge variant="secondary">{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
