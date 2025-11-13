'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  Eye,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  ExternalLink
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

interface Revision {
  revision_id: string;
  revision_number: number;
  data: Record<string, any>;
  created_by: User;
  created_at: string;
}

interface Contribution {
  entity_id: string;
  name: string;
  category: string;
  status: 'draft' | 'pending_review' | 'accepted' | 'rejected' | 'pending_revision';
  contributor: User;
  created_at: string;
  current_revision: Revision | null;
  latest_revision: Revision | null;
  activity_count: number;
}

interface ContributionsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Contribution[];
}

type CategoryType = 'all' | 'monument' | 'artifact' | 'ritual' | 'festival' | 'tradition' | 'document' | 'other';
type StatusType = 'all' | 'draft' | 'pending_review' | 'accepted' | 'rejected' | 'pending_revision';

export default function ContributionQueuePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const API_BASE = "http://0.0.0.0:8000/data/api/contribution-queue";
  const pageSize = 10;

  const categoryOptions: { value: CategoryType; label: string; color: string }[] = [
    { value: 'all', label: 'All Categories', color: 'bg-gray-100' },
    { value: 'monument', label: 'Monument', color: 'bg-blue-100 text-blue-800' },
    { value: 'artifact', label: 'Artifact', color: 'bg-green-100 text-green-800' },
    { value: 'ritual', label: 'Ritual', color: 'bg-purple-100 text-purple-800' },
    { value: 'festival', label: 'Festival', color: 'bg-orange-100 text-orange-800' },
    { value: 'tradition', label: 'Tradition', color: 'bg-red-100 text-red-800' },
    { value: 'document', label: 'Document', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800' },
  ];

  const statusOptions: { value: StatusType; label: string; color: string }[] = [
    { value: 'all', label: 'All Status', color: 'bg-gray-100' },
    { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800' },
    { value: 'pending_review', label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'accepted', label: 'Accepted', color: 'bg-green-100 text-green-800' },
    { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' },
    { value: 'pending_revision', label: 'Pending Revision', color: 'bg-blue-100 text-blue-800' },
  ];

  const fetchContributions = async (
    page: number = 1, 
    category: CategoryType = 'all', 
    status: StatusType = 'all', 
    search: string = ''
  ) => {
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
      
      if (category !== 'all') {
        url += `&category=${category}`;
      }
      
      if (status !== 'all') {
        url += `&status=${status}`;
      }
      
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      console.log('Fetching contributions from:', url);

      const res = await fetch(url, { headers });

      if (!res.ok) {
        throw new Error(`Failed to fetch contributions: ${res.status} ${res.statusText}`);
      }

      const data: ContributionsResponse = await res.json();
      
      console.log('Fetched contributions data:', data);
      setContributions(data.results);
      setTotalCount(data.count);
      setTotalPages(Math.ceil(data.count / pageSize));
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching contributions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load contributions');
      toast.error('Failed to load contributions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContributions(1, selectedCategory, selectedStatus, searchQuery);
  }, [session]);

  const handleRefresh = () => {
    fetchContributions(currentPage, selectedCategory, selectedStatus, searchQuery);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchContributions(1, selectedCategory, selectedStatus, searchQuery);
  };

  const handleCategoryChange = (value: CategoryType) => {
    setSelectedCategory(value);
    setCurrentPage(1);
    fetchContributions(1, value, selectedStatus, searchQuery);
  };

  const handleStatusChange = (value: StatusType) => {
    setSelectedStatus(value);
    setCurrentPage(1);
    fetchContributions(1, selectedCategory, value, searchQuery);
  };

  const handlePageChange = (page: number) => {
    fetchContributions(page, selectedCategory, selectedStatus, searchQuery);
  };

  // Navigation handlers
  const handleViewReport = (contribution: Contribution) => {
    router.push(`/dashboard/knowledge/viewreport/${contribution.entity_id}`);
  };

  const handleViewUser = (username: string) => {
    router.push(`/dashboard/users/${username}`);
  };

  const handleModerate = (contribution: Contribution, action: 'accept' | 'reject' | 'request_revision') => {
    // TODO: Implement moderation logic
    toast.info(`Moderation action ${action} for ${contribution.name} would be implemented here`);
  };

  const getCategoryBadge = (category: string) => {
    const option = categoryOptions.find(opt => opt.value === category);
    if (option) {
      return (
        <Badge variant="secondary" className={option.color}>
          {option.label}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        {category}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    if (option) {
      return (
        <Badge variant="secondary" className={option.color}>
          {option.label}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        {status}
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
    return `${user.first_name} ${user.last_name}`.trim() || user.username;
  };

  const getRevisionInfo = (contribution: Contribution) => {
    if (contribution.latest_revision) {
      return `Rev. ${contribution.latest_revision.revision_number} by ${formatUserName(contribution.latest_revision.created_by)}`;
    }
    return 'No revisions';
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
          Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} contributions
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
            <h1 className="text-3xl font-bold">Contribution Queue</h1>
            <p className="text-muted-foreground mt-2">
              Review and moderate user contributions to the heritage platform
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Contributions</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold">
                    {contributions.filter(c => c.status === 'pending_review').length}
                  </p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Revision</p>
                  <p className="text-2xl font-bold">
                    {contributions.filter(c => c.status === 'pending_revision').length}
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
                  <p className="text-sm font-medium text-muted-foreground">Active Contributors</p>
                  <p className="text-2xl font-bold">
                    {new Set(contributions.map(c => c.contributor.id)).size}
                  </p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <User className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
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
                      placeholder="Search contributions, names, or contributors..."
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

              {/* Category Filter */}
              <div className="w-full sm:w-48">
                <Label htmlFor="category" className="text-sm font-medium">
                  Category
                </Label>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-48">
                <Label htmlFor="status" className="text-sm font-medium">
                  Status
                </Label>
                <Select value={selectedStatus} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
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

        {/* Contributions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Contributions</CardTitle>
            <CardDescription>
              {selectedCategory === 'all' && selectedStatus === 'all'
                ? 'All user contributions awaiting review'
                : `Showing ${selectedCategory !== 'all' ? selectedCategory : ''} ${selectedStatus !== 'all' ? selectedStatus : ''} contributions`.trim()}
              {searchQuery && ` matching "${searchQuery}"`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-2 text-muted-foreground">Loading contributions...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="text-destructive text-lg mb-2">Error</div>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={handleRefresh}>Try Again</Button>
              </div>
            ) : contributions.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No contributions found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                    ? 'No contributions match your current filters. Try adjusting your search or filters.'
                    : 'No contributions have been submitted yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Entity ID</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Contributor</TableHead>
                        <TableHead>Latest Revision</TableHead>
                        <TableHead>Activities</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contributions.map((contribution) => (
                        <TableRow key={contribution.entity_id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            <button
                              onClick={() => handleViewReport(contribution)}
                              className="text-left hover:text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {contribution.name}
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleViewReport(contribution)}
                              className="text-sm text-muted-foreground font-mono hover:text-blue-600 hover:underline"
                            >
                              {contribution.entity_id.slice(0, 8)}...
                            </button>
                          </TableCell>
                          <TableCell>
                            {getCategoryBadge(contribution.category)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(contribution.status)}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleViewUser(contribution.contributor.username)}
                              className="text-left hover:text-blue-600 w-full"
                            >
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium hover:underline">
                                    {formatUserName(contribution.contributor)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    @{contribution.contributor.username}
                                  </div>
                                </div>
                              </div>
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {getRevisionInfo(contribution)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <span>{contribution.activity_count}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{formatDate(contribution.created_at)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewReport(contribution)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {contribution.status === 'pending_review' && (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleModerate(contribution, 'accept')}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleModerate(contribution, 'reject')}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleModerate(contribution, 'request_revision')}
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
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
      </div>
    </>
  );
}