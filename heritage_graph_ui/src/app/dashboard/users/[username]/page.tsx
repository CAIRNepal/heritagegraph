'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Mail,
  Edit3,
  Building,
  User,
  Globe,
  Twitter,
  Linkedin,
  Github,
  Facebook,
  Instagram,
  Copy,
  CheckCheck,
  Award,
  MapPin,
  GraduationCap,
  Calendar,
  Camera,
  Shield,
  FileText,
  MessageSquare,
  ClipboardList,
  ExternalLink,
  Plus,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type CustomSession = {
  accessToken?: string;
  user?: { username?: string; name?: string | null; email?: string | null; image?: string | null };
};

type OrgMembership = {
  id: string;
  name: string;
  short_name: string;
  role: string;
  logo: string | null;
};

type UserData = {
  username: string;
  email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  biography?: string;
  area_of_expertise?: string;
  country?: string;
  organization?: string;
  position?: string;
  university_school?: string;
  social_links?: Record<string, string>;
  website_link?: string;
  score?: number;
  member_since?: string;
  profile_image?: string | null;
  organizations?: OrgMembership[];
};

type ActivityItem = {
  activity_id: string;
  user: { username: string };
  activity_type: string;
  comment: string | null;
  created_at: string;
  entity_name?: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const SOCIAL_ICONS: Record<string, typeof Twitter> = {
  twitter: Twitter,
  linkedin: Linkedin,
  github: Github,
  facebook: Facebook,
  instagram: Instagram,
};

function relTime(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const { data: sessionData } = useSession();
  const session = sessionData as CustomSession | null;
  const isOwn = session?.user?.username === username;

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [updating, setUpdating] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [tab, setTab] = useState('activity');
  const imgRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    biography: '', area_of_expertise: '', country: '',
    organization: '', position: '', university_school: '',
    website_link: '', twitter: '', linkedin: '', github: '', facebook: '', instagram: '',
  });

  // Fetch user profile
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/data/api/user/${username}/`);
        if (!res.ok) throw new Error('User not found');
        const data = await res.json();
        setUser(data);
        setForm({
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
          biography: data.biography || '',
          area_of_expertise: data.area_of_expertise || '',
          country: data.country || '',
          organization: data.organization || '',
          position: data.position || '',
          university_school: data.university_school || '',
          website_link: data.website_link || '',
          twitter: data.social_links?.twitter || '',
          linkedin: data.social_links?.linkedin || '',
          github: data.social_links?.github || '',
          facebook: data.social_links?.facebook || '',
          instagram: data.social_links?.instagram || '',
        });
      } catch {
        toast.error('Failed to load user profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  // Fetch user activities
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/data/api/activities/?page_size=20`);
        if (!res.ok) return;
        const data = await res.json();
        // Filter to this user's activities
        setActivities(
          data.results?.filter((a: ActivityItem) => a.user?.username === username) || []
        );
      } catch { /* non-critical */ }
    })();
  }, [username]);

  const copyEmail = () => {
    if (user?.email) {
      navigator.clipboard.writeText(user.email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const body = {
        username: user?.username,
        email: user?.email,
        first_name: form.first_name,
        last_name: form.last_name,
        middle_name: form.middle_name || undefined,
        biography: form.biography,
        area_of_expertise: form.area_of_expertise,
        country: form.country,
        organization: form.organization,
        position: form.position,
        university_school: form.university_school,
        website_link: form.website_link,
        social_links: {
          ...(form.twitter && { twitter: form.twitter }),
          ...(form.linkedin && { linkedin: form.linkedin }),
          ...(form.github && { github: form.github }),
          ...(form.facebook && { facebook: form.facebook }),
          ...(form.instagram && { instagram: form.instagram }),
        },
      };
      const res = await fetch(`${API}/data/api/user/${username}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken ?? ''}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setUser(updated);
      toast.success('Profile updated');
      setIsEditOpen(false);
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('profile_image', file);
    try {
      const res = await fetch(`${API}/data/api/user/profile-image/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.accessToken ?? ''}` },
        body: fd,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUser(u => u ? { ...u, profile_image: data.profile_image } : u);
      toast.success('Profile image updated');
    } catch {
      toast.error('Failed to upload image');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <User className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">User not found</h2>
        <p className="text-muted-foreground">The profile for @{username} could not be loaded.</p>
      </div>
    );
  }

  const expertise = user.area_of_expertise?.split(',').map(s => s.trim()).filter(Boolean) || [];
  const socials = Object.entries(user.social_links || {}).filter(([, v]) => v);

  return (
    <>

      <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ──── Left column: profile card ──── */}
          <div className="w-full lg:w-[380px] shrink-0 space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-5">
                {/* Avatar + name */}
                <div className="flex items-start gap-4">
                  <div className="relative group">
                    <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                      {user.profile_image ? (
                        <img src={user.profile_image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    {isOwn && (
                      <button
                        onClick={() => imgRef.current?.click()}
                        className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Camera className="h-5 w-5 text-white" />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold truncate">
                      {user.first_name} {user.middle_name && `${user.middle_name} `}{user.last_name}
                    </h2>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Award className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">Score: {user.score || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                  <a href={`mailto:${user.email}`} className="flex items-center gap-2 min-w-0 flex-1">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{user.email}</span>
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyEmail}>
                    {emailCopied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                {/* Bio */}
                {user.biography && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Bio</h4>
                    <p className="text-sm leading-relaxed">{user.biography}</p>
                  </div>
                )}

                {/* Expertise */}
                {expertise.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Expertise</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {expertise.map((e, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{e}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick info */}
                <div className="space-y-2 text-sm">
                  {user.country && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" /> {user.country}
                    </div>
                  )}
                  {user.organization && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building className="h-4 w-4" /> {user.organization}
                    </div>
                  )}
                  {user.position && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="h-4 w-4" /> {user.position}
                    </div>
                  )}
                  {user.university_school && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GraduationCap className="h-4 w-4" /> {user.university_school}
                    </div>
                  )}
                  {user.member_since && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" /> Joined {user.member_since}
                    </div>
                  )}
                </div>

                {/* Social links */}
                {(socials.length > 0 || user.website_link) && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      {user.website_link && (
                        <a href={user.website_link} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 text-sm">
                          <Globe className="h-4 w-4" /> Website <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                        </a>
                      )}
                      {socials.map(([platform, url]) => {
                        const Icon = SOCIAL_ICONS[platform] || Globe;
                        return (
                          <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 text-sm capitalize">
                            <Icon className="h-4 w-4" /> {platform}
                            <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                          </a>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Edit button */}
                {isOwn && (
                  <>
                    <Separator />
                    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full gap-2"><Edit3 className="h-4 w-4" /> Edit Profile</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Profile</DialogTitle>
                          <DialogDescription>Update your public profile information.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSave} className="grid gap-4 py-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label htmlFor="first_name">First Name</Label>
                              <Input id="first_name" name="first_name" value={form.first_name} onChange={handleChange} required />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor="last_name">Last Name</Label>
                              <Input id="last_name" name="last_name" value={form.last_name} onChange={handleChange} required />
                            </div>
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor="middle_name">Middle Name</Label>
                            <Input id="middle_name" name="middle_name" value={form.middle_name} onChange={handleChange} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor="biography">Biography</Label>
                            <Textarea id="biography" name="biography" value={form.biography} onChange={handleChange} rows={3} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor="area_of_expertise">Expertise (comma separated)</Label>
                            <Input id="area_of_expertise" name="area_of_expertise" value={form.area_of_expertise} onChange={handleChange} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label htmlFor="country">Country</Label>
                              <Input id="country" name="country" value={form.country} onChange={handleChange} />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor="organization">Organization</Label>
                              <Input id="organization" name="organization" value={form.organization} onChange={handleChange} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label htmlFor="position">Position</Label>
                              <Input id="position" name="position" value={form.position} onChange={handleChange} />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor="university_school">University / School</Label>
                              <Input id="university_school" name="university_school" value={form.university_school} onChange={handleChange} />
                            </div>
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor="website_link">Website</Label>
                            <Input id="website_link" name="website_link" value={form.website_link} onChange={handleChange} />
                          </div>

                          <Separator />
                          <h4 className="font-medium">Social Links</h4>
                          {(['twitter', 'linkedin', 'github', 'facebook', 'instagram'] as const).map(s => {
                            const Icon = SOCIAL_ICONS[s] || Globe;
                            return (
                              <div key={s} className="grid gap-1.5">
                                <Label htmlFor={s} className="flex items-center gap-2 capitalize"><Icon className="h-4 w-4" /> {s}</Label>
                                <Input id={s} name={s} value={(form as any)[s]} onChange={handleChange} placeholder={`https://${s}.com/...`} />
                              </div>
                            );
                          })}

                          <div className="flex justify-end gap-3 mt-4">
                            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={updating}>Cancel</Button>
                            <Button type="submit" disabled={updating}>{updating ? 'Saving…' : 'Save Changes'}</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Organizations card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="h-4 w-4" /> Organizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {user.organizations && user.organizations.length > 0 ? (
                  <div className="space-y-2">
                    {user.organizations.map(org => (
                      <div key={org.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <div className="h-9 w-9 rounded bg-muted flex items-center justify-center text-xs font-bold">
                          {org.short_name?.[0] || org.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{org.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{org.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Building className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No organizations</p>
                    {isOwn && (
                      <Button variant="outline" size="sm" className="mt-2 gap-1"
                        onClick={() => router.push('/dashboard/community/organizations')}>
                        <Plus className="h-3 w-3" /> Browse Orgs
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ──── Right column: tabs ──── */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardContent className="pt-6">
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="activity" className="gap-1.5">
                      <ClipboardList className="h-4 w-4" /> Activity
                    </TabsTrigger>
                    <TabsTrigger value="contributions" className="gap-1.5">
                      <FileText className="h-4 w-4" /> Contributions
                    </TabsTrigger>
                    <TabsTrigger value="reviews" className="gap-1.5">
                      <Shield className="h-4 w-4" /> Reviews
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="gap-1.5">
                      <MessageSquare className="h-4 w-4" /> Comments
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="activity">
                    {activities.length > 0 ? (
                      <div className="space-y-3">
                        {activities.map(a => (
                          <div key={a.activity_id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                            <Badge variant="secondary" className="text-xs mt-0.5 shrink-0">{a.activity_type}</Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                {a.entity_name && <span className="font-medium">{a.entity_name}</span>}
                              </p>
                              {a.comment && <p className="text-xs text-muted-foreground mt-0.5">{a.comment}</p>}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{relTime(a.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyTab label="activity" />
                    )}
                  </TabsContent>

                  <TabsContent value="contributions">
                    <EmptyTab label="contributions" />
                  </TabsContent>

                  <TabsContent value="reviews">
                    <EmptyTab label="reviews" />
                  </TabsContent>

                  <TabsContent value="comments">
                    <EmptyTab label="comments" />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="text-center py-12">
      <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
      <h3 className="font-medium mb-1">No {label} yet</h3>
      <p className="text-sm text-muted-foreground">
        {label.charAt(0).toUpperCase() + label.slice(1)} for this user will appear here.
      </p>
    </div>
  );
}
