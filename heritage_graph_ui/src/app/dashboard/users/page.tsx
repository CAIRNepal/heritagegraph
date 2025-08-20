'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail,
  Edit3,
  Image,
  Link2,
  Building,
  Calendar,
  Filter,
  User,
  Shield,
  Bell,
  ClipboardList,
  Send,
  Edit,
} from 'lucide-react';

export default function Users() {
  const [activeTab, setActiveTab] = useState('activity');
  const [filters, setFilters] = useState({
    activityType: '',
    subjectType: '',
    organization: '',
    occurredAfter: '',
    occurredBefore: '',
  });

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="font-sans min-h-screen p-6 sm:p-12 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          {/* User Profile Card */}
          <Card className="w-full md:w-1/3 rounded-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full flex items-center justify-center">
                  <User className="h-10 w-10" />
                </div>
                <div>
                  <CardTitle className="text-xl">User Profile</CardTitle>
                  <p className="text-sm">Member since January 2023</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-1">Biography</h3>
                <p className="text-sm">User has not provided a job.</p>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1">Area of Expertise</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge className="text-xs">Unspecified</Badge>
                  <Badge className="text-xs">Organization</Badge>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1">Country</h3>
                <p className="text-sm">Unspecified</p>
              </div>

              <div className="pt-4 border-t">
                <Button className="w-full gap-2">
                  <Edit3 className="h-4 w-4" />
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Organization & Role Card */}
          <Card className="w-full md:w-2/3 rounded-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <Building className="h-5 w-5" />
                Organization & Roles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-2">Name</h3>
                <p className="text-sm p-3 rounded-lg">
                  User is not a member of any Organizations.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Role</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Badge className="flex items-center gap-1 justify-center py-1">
                    <User className="h-3 w-3" /> Contact
                  </Badge>
                  <Badge className="flex items-center gap-1 justify-center py-1">
                    <Link2 className="h-3 w-3" /> Personal Links
                  </Badge>
                  <Badge className="flex items-center gap-1 justify-center py-1">
                    <Send className="h-3 w-3" /> More provided
                  </Badge>
                  <Badge className="flex items-center gap-1 justify-center py-1">
                    <Mail className="h-3 w-3" /> Edit emails
                  </Badge>
                  <Badge className="flex items-center gap-1 justify-center py-1">
                    <Image className="h-3 w-3" /> Update images
                  </Badge>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Legend on Logo
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="evidence-items" />
                    <label htmlFor="evidence-items" className="text-sm">
                      Evidence Items
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="assertions" />
                    <label htmlFor="assertions" className="text-sm">
                      Assertions
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="source-suggestions" />
                    <label htmlFor="source-suggestions" className="text-sm">
                      Source Suggestions
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="notifications" />
                    <label htmlFor="notifications" className="text-sm">
                      Notifications
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Section */}
        <Card className="rounded-xl">
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
                <TabsTrigger value="moderations" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Moderations
                </TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="space-y-4">
                <div className="text-center py-12">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Activities Found</h3>
                  <p>
                    No activities found for this contributor that match specified
                    filters.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="comments">
                <div className="text-center py-12">
                  <Edit className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Comments Found</h3>
                  <p>This user hasn't made any comments yet.</p>
                </div>
              </TabsContent>

              <TabsContent value="revisions">
                <div className="text-center py-12">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Revisions Found</h3>
                  <p>This user hasn't made any revisions yet.</p>
                </div>
              </TabsContent>

              <TabsContent value="moderations">
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Moderations Found</h3>
                  <p>This user hasn't performed any moderation actions yet.</p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Filters Section */}
            <div className="mt-8 pt-6 border-t">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filter Activities
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="activity-type">Activity Type</Label>
                    <Select
                      value={filters.activityType}
                      onValueChange={(val) => handleFilterChange('activityType', val)}
                    >
                      <SelectTrigger id="activity-type">
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Activities</SelectItem>
                        <SelectItem value="comments">Comments</SelectItem>
                        <SelectItem value="revisions">Revisions</SelectItem>
                        <SelectItem value="submissions">Submissions</SelectItem>
                        <SelectItem value="moderations">Moderations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject-type">Subject Type</Label>
                    <Select
                      value={filters.subjectType}
                      onValueChange={(val) => handleFilterChange('subjectType', val)}
                    >
                      <SelectTrigger id="subject-type">
                        <SelectValue placeholder="Select Subject Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="organization">Organization</SelectItem>
                        <SelectItem value="content">Content</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organization">Participating Organization</Label>
                    <Select
                      value={filters.organization}
                      onValueChange={(val) => handleFilterChange('organization', val)}
                    >
                      <SelectTrigger id="organization">
                        <SelectValue placeholder="Select Organization" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="org1">Organization 1</SelectItem>
                        <SelectItem value="org2">Organization 2</SelectItem>
                        <SelectItem value="org3">Organization 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="occurred-after">Occurred After</Label>
                    <Input
                      id="occurred-after"
                      type="date"
                      value={filters.occurredAfter}
                      onChange={(e) =>
                        handleFilterChange('occurredAfter', e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="occurred-before">Occurred Before</Label>
                    <Input
                      id="occurred-before"
                      type="date"
                      value={filters.occurredBefore}
                      onChange={(e) =>
                        handleFilterChange('occurredBefore', e.target.value)
                      }
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-4">
                    <Checkbox id="include-child" />
                    <label htmlFor="include-child" className="text-sm">
                      Include child activities
                    </label>
                  </div>

                  <div className="pt-2">
                    <Button className="w-full">Apply Filters</Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
