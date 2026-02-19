'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast, Toaster } from 'sonner';
import {
  Building2,
  Globe,
  MapPin,
  Users,
  Plus,
  Search,
  LogIn,
  LogOut,
  CheckCircle2,
  Crown,
} from 'lucide-react';

type CustomSession = {
  accessToken?: string;
  user?: { username?: string; name?: string | null; email?: string | null };
};

type Organization = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  logo: string | null;
  website: string;
  country: string;
  focus_areas: string[];
  is_verified: boolean;
  owner_username: string;
  member_count: number;
  created_at: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function OrganizationsPage() {
  const { data: sessionData } = useSession();
  const session = sessionData as CustomSession | null;

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [myOrgs, setMyOrgs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', short_name: '', description: '',
    website: '', country: '', focus_areas: '',
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${session?.accessToken ?? ''}`,
  });

  // Fetch organizations
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/data/api/organizations/`);
        if (res.ok) {
          const data = await res.json();
          setOrgs(data.results || data);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch my organizations
  useEffect(() => {
    if (!session?.accessToken) return;
    (async () => {
      try {
        const res = await fetch(`${API}/data/api/organizations/my_organizations/`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setMyOrgs((data.results || data).map((o: Organization) => o.id));
        }
      } catch { /* ignore */ }
    })();
  }, [session?.accessToken]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const body = {
        name: form.name,
        short_name: form.short_name || form.name.substring(0, 10),
        description: form.description,
        website: form.website || undefined,
        country: form.country || undefined,
        focus_areas: form.focus_areas
          ? form.focus_areas.split(',').map(s => s.trim()).filter(Boolean)
          : [],
      };
      const res = await fetch(`${API}/data/api/organizations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.name?.[0] || 'Failed to create');
      }
      const created = await res.json();
      setOrgs(prev => [created, ...prev]);
      setMyOrgs(prev => [...prev, created.id]);
      setForm({ name: '', short_name: '', description: '', website: '', country: '', focus_areas: '' });
      setIsCreateOpen(false);
      toast.success(`${created.name} created!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (orgId: string) => {
    setJoiningId(orgId);
    try {
      const res = await fetch(`${API}/data/api/organizations/${orgId}/join/`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to join');
      }
      setMyOrgs(prev => [...prev, orgId]);
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, member_count: o.member_count + 1 } : o));
      toast.success('Joined organization!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (orgId: string) => {
    setJoiningId(orgId);
    try {
      const res = await fetch(`${API}/data/api/organizations/${orgId}/leave/`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      setMyOrgs(prev => prev.filter(id => id !== orgId));
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, member_count: Math.max(0, o.member_count - 1) } : o));
      toast.success('Left organization');
    } catch {
      toast.error('Failed to leave organization');
    } finally {
      setJoiningId(null);
    }
  };

  const filtered = orgs.filter(o => {
    const q = search.toLowerCase();
    return !q
      || o.name.toLowerCase().includes(q)
      || o.short_name.toLowerCase().includes(q)
      || o.description?.toLowerCase().includes(q)
      || o.country?.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" /> Organizations
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Browse and join organizations contributing to cultural heritage preservation.
            </p>
          </div>
          {session?.accessToken && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> New Organization</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Create Organization</DialogTitle>
                  <DialogDescription>Start a new organization to coordinate heritage research.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="grid gap-4 py-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Nepal Heritage Foundation" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="short_name">Short Name</Label>
                    <Input id="short_name" name="short_name" value={form.short_name} onChange={handleChange} placeholder="e.g. NHF" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" value={form.description} onChange={handleChange} rows={3} placeholder="What does your organization do?" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" name="country" value={form.country} onChange={handleChange} placeholder="e.g. Nepal" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="website">Website</Label>
                      <Input id="website" name="website" value={form.website} onChange={handleChange} placeholder="https://..." />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="focus_areas">Focus Areas (comma separated)</Label>
                    <Input id="focus_areas" name="focus_areas" value={form.focus_areas} onChange={handleChange} placeholder="Archaeology, Temples, Languages" />
                  </div>
                  <div className="flex justify-end gap-3 mt-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={creating}>Cancel</Button>
                    <Button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="h-14 w-14 mx-auto mb-3 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-1">No organizations found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search ? 'Try a different search term.' : 'Be the first to create one!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(org => {
              const isMember = myOrgs.includes(org.id);
              const isOwner = org.owner_username === session?.user?.username;
              return (
                <Card key={org.id} className="flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {org.logo ? (
                          <img src={org.logo} alt="" className="h-full w-full object-cover rounded-lg" />
                        ) : (
                          <span className="text-lg font-bold text-muted-foreground">
                            {org.short_name?.[0] || org.name[0]}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base truncate">{org.name}</CardTitle>
                          {org.is_verified && (
                            <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                          )}
                        </div>
                        <CardDescription className="text-xs">
                          {org.short_name && <span className="font-mono">{org.short_name}</span>}
                          {org.short_name && org.country && <span> · </span>}
                          {org.country && (
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />{org.country}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-3">
                    {org.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">{org.description}</p>
                    )}

                    {org.focus_areas && org.focus_areas.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {org.focus_areas.slice(0, 4).map((a, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                        ))}
                        {org.focus_areas.length > 4 && (
                          <Badge variant="outline" className="text-xs">+{org.focus_areas.length - 4}</Badge>
                        )}
                      </div>
                    )}

                    <div className="mt-auto pt-3">
                      <Separator className="mb-3" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" /> {org.member_count} member{org.member_count !== 1 ? 's' : ''}
                          </span>
                          {org.website && (
                            <a href={org.website} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 hover:text-foreground">
                              <Globe className="h-3.5 w-3.5" /> Website
                            </a>
                          )}
                        </div>

                        {session?.accessToken && (
                          <div>
                            {isOwner ? (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Crown className="h-3 w-3" /> Owner
                              </Badge>
                            ) : isMember ? (
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                                disabled={joiningId === org.id} onClick={() => handleLeave(org.id)}>
                                <LogOut className="h-3 w-3" /> Leave
                              </Button>
                            ) : (
                              <Button size="sm" className="h-7 text-xs gap-1"
                                disabled={joiningId === org.id} onClick={() => handleJoin(org.id)}>
                                <LogIn className="h-3 w-3" /> Join
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
