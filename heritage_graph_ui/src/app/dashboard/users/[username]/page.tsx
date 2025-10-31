'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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
import { toast } from 'sonner';
import {
  Mail,
  Edit3,
  Building,
  Filter,
  User,
  Shield,
  Bell,
  ClipboardList,
  Edit,
  Globe,
  Twitter,
  Linkedin,
  Github,
  Facebook,
  Instagram,
  Copy,
  CheckCheck,
  Award,
} from 'lucide-react';

// Extend session type locally (so session.accessToken works)
type CustomSession = {
  accessToken?: string;
  user?: {
    username?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
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
  social_links?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
    facebook?: string;
    instagram?: string;
  };
  website_link?: string;
  score?: number;
  member_since?: string;
};

export default function UserPage() {
  const params = useParams();
  const username = params.username as string;
  const { data: sessionData } = useSession();
  const session = sessionData as CustomSession | null;

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');
  const [emailCopied, setEmailCopied] = useState(false);
  const [linksExpanded, setLinksExpanded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    biography: '',
    area_of_expertise: '',
    country: '',
    organization: '',
    position: '',
    university_school: '',
    website_link: '',
    twitter: '',
    linkedin: '',
    github: '',
    facebook: '',
    instagram: '',
  });

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`http://127.0.0.1:8000/data/user/${username}/`);
        if (!res.ok) throw new Error('User not found');
        const data = await res.json();
        setUser(data);

        // Initialize form data
        if (data) {
          setEditFormData({
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
        }
      } catch (err) {
        console.error(err);
        toast('Error', { description: 'Failed to load user data' });
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [username]);

  const copyEmail = () => {
    if (user?.email) {
      navigator.clipboard.writeText(user.email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);

    try {
      const updateData = {
        username: user?.username,
        email: user?.email,
        first_name: editFormData.first_name,
        last_name: editFormData.last_name,
        middle_name: editFormData.middle_name || undefined,
        biography: editFormData.biography,
        area_of_expertise: editFormData.area_of_expertise,
        country: editFormData.country,
        organization: editFormData.organization,
        position: editFormData.position,
        university_school: editFormData.university_school,
        website_link: editFormData.website_link,
        social_links: {
          twitter: editFormData.twitter || undefined,
          linkedin: editFormData.linkedin || undefined,
          github: editFormData.github || undefined,
          facebook: editFormData.facebook || undefined,
          instagram: editFormData.instagram || undefined,
        },
      };

      // ✅ Clean undefined keys
      Object.keys(updateData).forEach((key) => {
        const typedKey = key as keyof typeof updateData;
        if (updateData[typedKey] === undefined) {
          delete updateData[typedKey];
        }
      });

      Object.keys(updateData.social_links).forEach((key) => {
        const typedKey = key as keyof typeof updateData.social_links;
        if (updateData.social_links[typedKey] === undefined) {
          delete updateData.social_links[typedKey];
        }
      });

      const response = await fetch(`http://127.0.0.1:8000/data/user/${username}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken ?? ''}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) throw new Error('Failed to update user data');

      const updatedUser = await response.json();
      setUser(updatedUser);

      toast('Success', { description: 'Profile updated successfully' });
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Update error:', error);
      toast('Error', { description: 'Failed to update profile' });
    } finally {
      setUpdating(false);
    }
  };
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading user profile...</p>
      </div>
    );
  if (!user)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500 text-lg">User not found</p>
      </div>
    );

  const expertiseList = user.area_of_expertise
    ? user.area_of_expertise.split(',').map((item) => item.trim())
    : [];
  const displayedLinks = linksExpanded
    ? Object.entries(user.social_links || {})
    : Object.entries(user.social_links || {}).slice(0, 3);

  return (
    <div className="min-h-screen p-6 sm:p-8 pb-20 bg-muted/20">
      {/* <div className="max-w-6xl mx-auto"> */}
      <div className="mx-auto">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          {/* User Profile Card */}
          <Card className="w-full lg:w-2/5 rounded-xl shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-md bg-primary/10 flex items-center justify-center">
                  <User className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl truncate">
                    {user.first_name} {user.middle_name && `${user.middle_name} `}
                    {user.last_name}
                  </CardTitle>
                  <CardDescription className="truncate">
                    @{user.username}
                  </CardDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">
                      Score: {user.score || 0}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <a
                  href={`mailto:${user.email}`}
                  className="flex items-center gap-2 min-w-0 flex-1"
                >
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm truncate">{user.email}</span>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyEmail}
                  className="h-8 w-8 flex-shrink-0"
                >
                  {emailCopied ? (
                    <CheckCheck className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1">Biography</h3>
                <p className="text-sm p-3 rounded-lg bg-muted/30">
                  {user.biography || 'User has not provided a biography.'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1">Area of Expertise</h3>
                <div className="flex flex-wrap gap-2">
                  {expertiseList.length > 0 ? (
                    expertiseList.map((item, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Unspecified</span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1">Country</h3>
                <p className="text-sm">{user.country || 'Unspecified'}</p>
              </div>

              {(user.social_links && Object.keys(user.social_links).length > 0) ||
              user.website_link ? (
                <div>
                  <h3 className="text-sm font-medium mb-2">Links</h3>
                  <div className="space-y-2">
                    {user.website_link && (
                      <a
                        href={user.website_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Globe className="h-4 w-4" />
                        <span className="text-sm truncate">Personal Website</span>
                      </a>
                    )}

                    {displayedLinks.map(([platform, url]) => {
                      const Icon =
                        platform === 'twitter'
                          ? Twitter
                          : platform === 'linkedin'
                            ? Linkedin
                            : platform === 'github'
                              ? Github
                              : platform === 'facebook'
                                ? Facebook
                                : platform === 'instagram'
                                  ? Instagram
                                  : Globe;

                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-sm capitalize truncate">
                            {platform}
                          </span>
                        </a>
                      );
                    })}

                    {user.social_links && Object.keys(user.social_links).length > 3 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setLinksExpanded(!linksExpanded)}
                      >
                        {linksExpanded
                          ? 'Show less'
                          : `Show ${Object.keys(user.social_links).length - 3} more`}
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}

              {session?.user?.username === user.username && (
                <div className="pt-4 border-t">
                  <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full gap-2">
                        <Edit3 className="h-4 w-4" />
                        Edit Profile
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Profile</DialogTitle>
                        <DialogDescription>
                          Make changes to your profile here. Click save when you&apos;re
                          done.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="first_name">First Name</Label>
                            <Input
                              id="first_name"
                              name="first_name"
                              value={editFormData.first_name}
                              onChange={handleInputChange}
                              required
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="last_name">Last Name</Label>
                            <Input
                              id="last_name"
                              name="last_name"
                              value={editFormData.last_name}
                              onChange={handleInputChange}
                              required
                            />
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="middle_name">Middle Name (Optional)</Label>
                          <Input
                            id="middle_name"
                            name="middle_name"
                            value={editFormData.middle_name}
                            onChange={handleInputChange}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="biography">Biography</Label>
                          <Textarea
                            id="biography"
                            name="biography"
                            value={editFormData.biography}
                            onChange={handleInputChange}
                            rows={4}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="area_of_expertise">
                            Area of Expertise (comma separated)
                          </Label>
                          <Input
                            id="area_of_expertise"
                            name="area_of_expertise"
                            value={editFormData.area_of_expertise}
                            onChange={handleInputChange}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="country">Country</Label>
                          <Input
                            id="country"
                            name="country"
                            value={editFormData.country}
                            onChange={handleInputChange}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="organization">Organization</Label>
                          <Input
                            id="organization"
                            name="organization"
                            value={editFormData.organization}
                            onChange={handleInputChange}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="position">Position</Label>
                          <Input
                            id="position"
                            name="position"
                            value={editFormData.position}
                            onChange={handleInputChange}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="university_school">University/School</Label>
                          <Input
                            id="university_school"
                            name="university_school"
                            value={editFormData.university_school}
                            onChange={handleInputChange}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="website_link">Website Link</Label>
                          <Input
                            id="website_link"
                            name="website_link"
                            value={editFormData.website_link}
                            onChange={handleInputChange}
                          />
                        </div>

                        <div className="border-t pt-4 mt-2">
                          <h3 className="text-lg font-medium mb-4">Social Links</h3>
                          <div className="grid gap-4">
                            <div className="grid gap-2">
                              <Label
                                htmlFor="twitter"
                                className="flex items-center gap-2"
                              >
                                <Twitter className="h-4 w-4" /> Twitter
                              </Label>
                              <Input
                                id="twitter"
                                name="twitter"
                                value={editFormData.twitter}
                                onChange={handleInputChange}
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label
                                htmlFor="linkedin"
                                className="flex items-center gap-2"
                              >
                                <Linkedin className="h-4 w-4" /> LinkedIn
                              </Label>
                              <Input
                                id="linkedin"
                                name="linkedin"
                                value={editFormData.linkedin}
                                onChange={handleInputChange}
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label
                                htmlFor="github"
                                className="flex items-center gap-2"
                              >
                                <Github className="h-4 w-4" /> GitHub
                              </Label>
                              <Input
                                id="github"
                                name="github"
                                value={editFormData.github}
                                onChange={handleInputChange}
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label
                                htmlFor="facebook"
                                className="flex items-center gap-2"
                              >
                                <Facebook className="h-4 w-4" /> Facebook
                              </Label>
                              <Input
                                id="facebook"
                                name="facebook"
                                value={editFormData.facebook}
                                onChange={handleInputChange}
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label
                                htmlFor="instagram"
                                className="flex items-center gap-2"
                              >
                                <Instagram className="h-4 w-4" /> Instagram
                              </Label>
                              <Input
                                id="instagram"
                                name="instagram"
                                value={editFormData.instagram}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsEditModalOpen(false)}
                            disabled={updating}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={updating}>
                            {updating ? 'Updating...' : 'Save Changes'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Organization & Details Card */}
          <div className="w-full lg:w-3/5 space-y-6">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Professional Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Organization</h3>
                  <p className="text-sm p-3 rounded-lg bg-muted/30">
                    {user.organization || 'Not specified'}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Position</h3>
                  <p className="text-sm p-3 rounded-lg bg-muted/30">
                    {user.position || 'Not specified'}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Education</h3>
                  <p className="text-sm p-3 rounded-lg bg-muted/30">
                    {user.university_school || 'Not specified'}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Member Since</h3>
                  <p className="text-sm p-3 rounded-lg bg-muted/30">
                    {user.member_since || 'Not specified'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Activity Section */}
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Activity Feed
                  </CardTitle>
                  <Button size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filter Activities
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid grid-cols-4 mb-6">
                    <TabsTrigger value="activity" className="flex items-center gap-2">
                      <Bell className="h-4 w-4" /> Activity
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="flex items-center gap-2">
                      <Edit className="h-4 w-4" /> Comments
                    </TabsTrigger>
                    <TabsTrigger value="revisions" className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" /> Revisions
                    </TabsTrigger>
                    <TabsTrigger
                      value="moderations"
                      className="flex items-center gap-2"
                    >
                      <Shield className="h-4 w-4" /> Moderations
                    </TabsTrigger>
                  </TabsList>

                  {/* Tabs Content */}
                  {['activity', 'comments', 'revisions', 'moderations'].map((tab) => (
                    <TabsContent
                      key={tab}
                      value={tab}
                      className="space-y-4 text-center py-12"
                    >
                      <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">
                        No {tab.charAt(0).toUpperCase() + tab.slice(1)} Found
                      </h3>
                      <p className="text-muted-foreground">
                        No {tab} found for this user.
                      </p>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
