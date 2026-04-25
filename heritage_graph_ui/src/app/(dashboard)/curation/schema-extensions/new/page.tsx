'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import { useUserRoles } from '@/hooks/use-user-roles';

export default function NewSchemaExtensionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isReviewer } = useUserRoles();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [yaml, setYaml] = useState('# classes:\n#   MyClass:\n#     slots: []\n');
  const [saving, setSaving] = useState(false);
  const api = getPublicApiUrl();

  const headers = useCallback((): HeadersInit => {
    const token = (session as Record<string, unknown>)?.accessToken as string | undefined;
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [session]);

  const save = async () => {
    if (!api) return;
    try {
      setSaving(true);
      const created = await apiFetchJson<{ id: string }>(
        `${api}/data/api/schema-extension-proposals/`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ title, description, proposed_yaml: yaml }),
        },
      );
      toast.success('Draft created');
      router.push(`/curation/schema-extensions/${created.id}`);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not create draft.'));
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || !session) return null;
  if (!isReviewer) {
    return <div className="p-8 text-muted-foreground text-center">Reviewer access required.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">New schema extension</h1>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="desc">Description</Label>
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="yaml">Proposed YAML (registry overlay: classes / enums)</Label>
        <Textarea id="yaml" value={yaml} onChange={(e) => setYaml(e.target.value)} rows={16} className="font-mono text-sm" />
      </div>
      <Button onClick={() => void save()} disabled={saving || !title.trim()}>
        {saving ? 'Saving…' : 'Create draft'}
      </Button>
    </div>
  );
}
