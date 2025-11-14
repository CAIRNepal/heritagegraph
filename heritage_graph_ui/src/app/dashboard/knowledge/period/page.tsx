'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toaster, toast } from 'sonner';
import {
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Calendar,
  Search,
  Filter,
} from 'lucide-react';

// ------------------ TYPES ------------------

interface HistoricalPeriod {
  id: number;
  name: string;
  start_year: string;
  end_year: string;
  description: string;
}

interface PeriodApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: HistoricalPeriod[];
}

interface DisplayPeriod {
  entity_id: string;
  name: string;
  description: string;
  created_at: string;
  raw: HistoricalPeriod;
}

// ---------------- PAGINATION -------------------

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = [];
  const maxVisible = 5;

  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between px-2 mt-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-1">
          {start > 1 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onPageChange(1)}>
                1
              </Button>
              {start > 2 && <MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
            </>
          )}

          {pages.map(p => (
            <Button
              key={p}
              variant={p === currentPage ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ))}

          {end < totalPages && (
            <>
              {end < totalPages - 1 && <MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
              <Button variant="ghost" size="sm" onClick={() => onPageChange(totalPages)}>
                {totalPages}
              </Button>
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
}

// ---------------- HOVER CARD -------------------

function PeriodHoverCard({ period, children }: { period: DisplayPeriod; children: React.ReactNode }) {
  const raw = period.raw;
  const router = useRouter();

const handleViewProfile = () => {
  router.push(`/dashboard/knowledge/period/view/${period.entity_id}`);
};

const handleViewDetails = () => {
  router.push(`/dashboard/knowledge/period/view/${period.entity_id}`);
};


  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>

      <HoverCardContent className="w-96" align="start">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">{raw.name}</h4>

          <p className="text-sm text-muted-foreground">{raw.description}</p>

          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {raw.start_year} → {raw.end_year}
            </div>
          </div>
          <Button variant="outline" className="mt-2 w-full text-xs" onClick={handleViewProfile}>
            View Profile
          </Button>


          <Button variant="default" className="mt-2 w-full text-xs" onClick={handleViewDetails}>
            View Details
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// ---------------- ADD PERIOD FORM -------------------

function AddHistoricalPeriodForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // TODO: Implement form submission logic
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    toast.success('Historical period added successfully!');
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">Period Name</label>
        <Input id="name" placeholder="Enter period name" required />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="startYear" className="text-sm font-medium">Start Year</label>
          <Input id="startYear" placeholder="e.g., 1400" required />
        </div>
        <div className="space-y-2">
          <label htmlFor="endYear" className="text-sm font-medium">End Year</label>
          <Input id="endYear" placeholder="e.g., 1500" required />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">Description</label>
        <textarea
          id="description"
          placeholder="Enter period description"
          className="w-full min-h-[100px] p-2 border rounded-md text-sm"
          required
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add Historical Period'}
        </Button>
      </div>
    </form>
  );
}

// ---------------- MAIN PAGE -------------------

export default function HistoricalPeriodsPage() {
  const router = useRouter();

  const [periods, setPeriods] = useState<DisplayPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    yearRange: 'all',
  });

  const fetchPeriods = useCallback(async (page: number = 1, search: string = '', filterParams: any = {}) => {
    setIsLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      let url = `http://0.0.0.0:8000/cidoc/historical_periods/?limit=${pageSize}&offset=${offset}`;
      
      // Add search parameter
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }
      
      // Add filter parameters
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value && value !== 'all') {
          url += `&${key}=${encodeURIComponent(value)}`;
        }
      });

      const res = await fetch(url, { headers: { Accept: 'application/json' } });

      if (!res.ok) {
        toast.error('Failed to load historical periods');
        setPeriods([]);
        return;
      }

      const data: PeriodApiResponse = await res.json();

      const normalized = data.results.map(p => ({
        entity_id: String(p.id),
        name: p.name,
        description: p.description,
        created_at: p.start_year,
        raw: p,
      }));

      setPeriods(normalized);
      setTotalCount(data.count);
      setTotalPages(Math.max(1, Math.ceil(data.count / pageSize)));
      setCurrentPage(page);
    } catch (e) {
      toast.error('Network error while loading periods');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriods(1);
  }, [fetchPeriods]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    fetchPeriods(1, value, filters);
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchPeriods(1, searchTerm, newFilters);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ yearRange: 'all' });
    fetchPeriods(1);
  };

  return (
    <>
      <Toaster position="top-right" richColors />

      <div className="px-4 lg:px-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Historical Periods (CIDOC)</CardTitle>
          </CardHeader>

          <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start justify-between">
            <div className="flex-1">
              <CardDescription className="text-base">
                These represent eras or periods within the historical timeline dynasties,
                golden ages, cultural periods, etc.
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Historical Period
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add New Historical Period</DialogTitle>
                  <DialogDescription>
                    Add a new historical period to the database. Fill in the required information below.
                  </DialogDescription>
                </DialogHeader>
                <AddHistoricalPeriodForm />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search historical periods..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Filter className="h-3 w-3" />
                    Year Range
                  </label>
                  <Select value={filters.yearRange} onValueChange={(value) => handleFilterChange('yearRange', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All periods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All periods</SelectItem>
                      <SelectItem value="ancient">Ancient (Before 500 CE)</SelectItem>
                      <SelectItem value="medieval">Medieval (500-1500)</SelectItem>
                      <SelectItem value="early-modern">Early Modern (1500-1800)</SelectItem>
                      <SelectItem value="modern">Modern (1800-Present)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Filter className="h-3 w-3" />
                    Sort By
                  </label>
                  <Select onValueChange={(value) => handleFilterChange('ordering', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Default order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="start_year">Start Year (Ascending)</SelectItem>
                      <SelectItem value="-start_year">Start Year (Descending)</SelectItem>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                      <SelectItem value="-name">Name (Z-A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters */}
              {(searchTerm || filters.yearRange !== 'all') && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear all filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table Section */}
        <Card>
          <CardHeader>
            <CardTitle>Historical Periods</CardTitle>
            <CardDescription>Total: {totalCount}</CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <p className="text-muted-foreground mt-2">Loading periods...</p>
              </div>
            ) : periods.length === 0 ? (
              <div className="text-center py-10">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg">No periods found</h3>
                <p className="text-muted-foreground mt-2">
                  {searchTerm || filters.yearRange !== 'all' 
                    ? 'Try adjusting your search or filters' 
                    : 'No historical periods available'
                  }
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-12">Actions</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {periods.map((period) => (
                        <PeriodHoverCard key={period.entity_id} period={period}>
                          <TableRow className="cursor-pointer">
                            <TableCell className="font-medium">{period.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{period.raw.start_year}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{period.raw.end_year}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                              {period.raw.description}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        </PeriodHoverCard>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(page) => fetchPeriods(page, searchTerm, filters)}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}