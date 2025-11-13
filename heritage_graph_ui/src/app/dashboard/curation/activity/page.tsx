'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  User,
  Calendar,
  FileText,
  RefreshCw,
  Search,
  Filter,
  Download,
  Upload
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

// --- TYPES ---
interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface Monument {
  id: string;
  name: string;
  type: string;
  location: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface Activity {
  activity_id: string;
  user: User;
  activity_type: string;
  comment: string | null;
  created_at: string;
  entity_id?: string;
  entity_name?: string;
  monument?: Monument;
}

interface ActivitiesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Activity[];
}

type ActivityType = 'all' | 'submitted' | 'revised' | 'approved' | 'rejected' | 'commented';

export default function ActivitiesPage() {
  const { data: session } = useSession();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const API_BASE = "http://0.0.0.0:8000/data/api/activities";
  const pageSize = 10;

  const activityTypeOptions: { value: ActivityType; label: string; color: string }[] = [
    { value: 'all', label: 'All Activities', color: 'bg-gray-100' },
    { value: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-800' },
    { value: 'revised', label: 'Revised', color: 'bg-purple-100 text-purple-800' },
    { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' },
    { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' },
    { value: 'commented', label: 'Commented', color: 'bg-yellow-100 text-yellow-800' },
  ];

  const fetchActivities = async (page: number = 1, activityType: ActivityType = 'all', search: string = '') => {
    try {
      setIsLoading(true);
      setError(null);

      const token = (session as any)?.accessToken;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let url = `${API_BASE}/?page=${page}&limit=${pageSize}`;
      
      if (activityType !== 'all') {
        url += `&activity_type=${activityType}`;
      }
      
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      console.log('Fetching activities from:', url);

      const res = await fetch(url, { headers });

      if (!res.ok) {
        throw new Error(`Failed to fetch activities: ${res.status} ${res.statusText}`);
      }

      const data: ActivitiesResponse = await res.json();
      
      console.log('Fetched activities data:', data);
      setActivities(data.results);
      setTotalCount(data.count);
      setTotalPages(Math.ceil(data.count / pageSize));
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activities');
      toast.error('Failed to load activities');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(1, selectedActivityType, searchQuery);
  }, [session]);

  const handleRefresh = () => {
    fetchActivities(currentPage, selectedActivityType, searchQuery);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchActivities(1, selectedActivityType, searchQuery);
  };

  const handleActivityTypeChange = (value: ActivityType) => {
    setSelectedActivityType(value);
    setCurrentPage(1);
    fetchActivities(1, value, searchQuery);
  };

  const handlePageChange = (page: number) => {
    fetchActivities(page, selectedActivityType, searchQuery);
  };

  const getActivityTypeBadge = (activityType: string) => {
    const option = activityTypeOptions.find(opt => opt.value === activityType);
    if (option) {
      return (
        <Badge variant="secondary" className={option.color}>
          {option.label}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        {activityType}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatUserName = (user: User) => {
    return `${user.first_name} ${user.last_name} (${user.username})`;
  };

  // Helper function to get monument information if available
  const getMonumentInfo = (activity: Activity) => {
    if (activity.monument) {
      return `${activity.monument.name} - ${activity.monument.location}`;
    }
    return activity.entity_name || 'N/A';
  };

  const Pagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-muted-foreground">
          Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} activities
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          
          <div className="flex items-center space-x-1">
            {startPage > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  className="h-8 w-8 p-0"
                >
                  1
                </Button>
                {startPage > 2 && <span className="text-muted-foreground">...</span>}
              </>
            )}
            
            {pages.map(page => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "ghost"}
                size="sm"
                onClick={() => handlePageChange(page)}
                className="h-8 w-8 p-0"
              >
                {page}
              </Button>
            ))}
            
            {endPage < totalPages && (
              <>
                {endPage < totalPages - 1 && <span className="text-muted-foreground">...</span>}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  className="h-8 w-8 p-0"
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Activities</h1>
            <p className="text-muted-foreground mt-2">
              Track all user activities and submissions across the platform
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search activities, users, monuments, or comments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button type="submit" variant="default">
                    Search
                  </Button>
                </form>
              </div>

              {/* Activity Type Filter */}
              <div className="w-full sm:w-48">
                <Label htmlFor="activity-type" className="text-sm font-medium">
                  Activity Type
                </Label>
                <Select value={selectedActivityType} onValueChange={handleActivityTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activities Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>
              {selectedActivityType === 'all' 
                ? 'All user activities across the platform'
                : `Showing ${selectedActivityType} activities`}
              {searchQuery && ` matching "${searchQuery}"`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-2 text-muted-foreground">Loading activities...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="text-destructive text-lg mb-2">Error</div>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={handleRefresh}>Try Again</Button>
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No activities found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || selectedActivityType !== 'all' 
                    ? 'No activities match your current filters. Try adjusting your search or filters.'
                    : 'No activities have been recorded yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Activity Type</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activities.map((activity) => (
                        <TableRow key={activity.activity_id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{formatUserName(activity.user)}</div>
                                {/* <div className="text-sm text-muted-foreground">{activity.user.email}</div> */}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getActivityTypeBadge(activity.activity_type)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {getMonumentInfo(activity)}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            {activity.comment ? (
                              <p className="text-sm line-clamp-2">{activity.comment}</p>
                            ) : (
                              <span className="text-muted-foreground text-sm">No comment</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{formatDate(activity.created_at)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                <Pagination />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Activities</p>
                  <p className="text-2xl font-bold">{totalCount}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Submissions</p>
                  <p className="text-2xl font-bold">
                    {activities.filter(a => a.activity_type === 'submitted').length}
                  </p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Upload className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Revisions</p>
                  <p className="text-2xl font-bold">
                    {activities.filter(a => a.activity_type === 'revised').length}
                  </p>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <RefreshCw className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold">
                    {new Set(activities.map(a => a.user.id)).size}
                  </p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <User className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}