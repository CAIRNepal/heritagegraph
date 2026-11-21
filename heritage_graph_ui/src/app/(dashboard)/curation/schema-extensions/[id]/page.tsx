'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import { useUserRoles } from '@/hooks/use-user-roles';

interface ProposalDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  proposed_yaml: string;
  author?: number;
  change_summary?: unknown;
  moderator_comment?: string;
}

interface AuditRow {
  id: string;
  action: string;
  from_status: string;
  to_status: string;
  comment: string;
  created_at: string;
}

export default function SchemaExtensionDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { isModerator } = useUserRoles();
  const api = getPublicApiUrl();
  const [row, setRow] = useState<ProposalDetail | null>(null);
  const [yaml, setYaml] = useState('');
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = useCallback((): HeadersInit => {
    const token = (session as unknown as Record<string, unknown>)?.accessToken as string | undefined;
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [session]);

  const load = useCallback(async () => {
    if (!api || !id) return;
    try {
      setLoading(true);
      const p = await apiFetchJson<ProposalDetail>(
        `${api}/data/api/schema-extension-proposals/${id}/`,
        { headers: headers() },
      );
      setRow(p);
      setYaml(p.proposed_yaml || '');
      const a = await apiFetchJson<AuditRow[]>(
        `${api}/data/api/schema-extension-proposals/${id}/audit/`,
        { headers: headers() },
      );
      setAudit(Array.isArray(a) ? a : []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not load proposal.'));
    } finally {
      setLoading(false);
    }
  }, [api, headers, id]);

  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [status, load]);

  const postAction = async (path: string, body?: Record<string, string>) => {
    if (!api) return;
    try {
      await apiFetchJson(`${api}/data/api/schema-extension-proposals/${id}/${path}/`, {
        method: 'POST',
        headers: headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      toast.success('Updated');
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Action failed.'));
    }
  };

  if (status === 'loading' || !session || loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!row) return <div className="p-8 text-center text-muted-foreground">Not found</div>;

  const uid = (session as { user?: { id?: string } }).user?.id;
  const isAuthor = row.author != null && String(row.author) === String(uid);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{row.title}</h1>
        <Badge>{row.status}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{row.description}</p>

      {row.status === 'draft' && isAuthor && (
        <div className="space-y-2">
          <Label>Draft YAML</Label>
          <Textarea value={yaml} onChange={(e) => setYaml(e.target.value)} rows={14} className="font-mono text-sm" />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                if (!api) return;
                try {
                  await apiFetchJson(`${api}/data/api/schema-extension-proposals/${id}/`, {
                    method: 'PATCH',
                    headers: headers(),
                    body: JSON.stringify({ proposed_yaml: yaml }),
                  });
                  toast.success('Saved');
                  await load();
                } catch (e) {
                  toast.error(getApiErrorMessage(e, 'Save failed'));
                }
              }}
            >
              Save draft
            </Button>
            <Button onClick={() => void postAction('submit')}>Submit for review</Button>
          </div>
        </div>
      )}

      {row.status === 'submitted' && isAuthor && (
        <Button variant="outline" onClick={() => void postAction('withdraw')}>
          Withdraw
        </Button>
      )}

      {row.status === 'submitted' && isModerator && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void postAction('approve', { comment: 'LGTM' })}>Approve</Button>
          <Button variant="destructive" onClick={() => {
            const c = window.prompt('Rejection comment (required)') || '';
            if (!c.trim()) { toast.error('Comment required'); return; }
            void postAction('reject', { comment: c });
          }}
          >
            Reject
          </Button>
        </div>
      )}

      {row.status === 'approved' && isModerator && (
        <Button onClick={() => void postAction('publish')}>Publish to extension path</Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change summary</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto bg-muted p-3 rounded-md">
            {JSON.stringify(row.change_summary ?? {}, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit trail</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2">
            {audit.map((x) => (
              <li key={x.id} className="border-b pb-2">
                <span className="font-medium">{x.action}</span>{' '}
                <span className="text-muted-foreground">{x.from_status} → {x.to_status}</span>
                {x.comment ? <div className="text-xs mt-1">{x.comment}</div> : null}
                <div className="text-xs text-muted-foreground">{x.created_at}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Button variant="ghost" onClick={() => router.push('/curation/schema-extensions')}>
        Back to list
      </Button>
    </div>
  );
}
