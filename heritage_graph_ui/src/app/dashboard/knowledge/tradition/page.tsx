'use client';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Calendar, User, Eye, Plus, Search, Filter, MoreHorizontal } from 'lucide-react';

// --- TYPES ---
type Tradition = {
  id: number;
  name: string;
  type: string;
  description: string;
  associated_materials: string;
  practitioners: number[];
  artifacts_used: number[];
  associated_events: number[];
};

interface TraditionResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Tradition[];
}

// --- PAGINATION ---
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  const pages: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className={`flex items-center justify-between px-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </Button>

        {start > 1 && (
          <>
            <Button variant="ghost" size="sm" onClick={() => onPageChange(1)}>1</Button>
            {start > 2 && <MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
          </>
        )}

        {pages.map(p => (
          <Button
            key={p}
            variant={currentPage === p ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
            <Button variant="ghost" size="sm" onClick={() => onPageChange(totalPages)}>{totalPages}</Button>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
}

// --- HOVER CARD FOR TRADITIONS ---
interface TraditionHoverProps {
  tradition: Tradition;
  children: React.ReactNode;
}

function TraditionHoverCard({ tradition, children }: TraditionHoverProps) {
  const truncate = (text: string, max: number = 150) =>
    text.length > max ? text.substring(0, max) + '...' : text || '—';

    const router = useRouter();

const handleViewProfile = () => {
  router.push(`/dashboard/knowledge/tradition/view/${tradition.id}`);
};

const handleViewDetails = () => {
  router.push(`/dashboard/knowledge/tradition/view/${tradition.id}`);
};

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-96" align="start">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{tradition.name}</h4>
          <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
            <Badge variant="outline">{tradition.type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{truncate(tradition.description)}</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>Practitioners: {tradition.practitioners.length || '—'}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                <span>Events: {tradition.associated_events.length || '—'}</span>
              </div>
            </div>
            <div>
              <div>Materials: {tradition.associated_materials || '—'}</div>
              <div>Artifacts Used: {tradition.artifacts_used.length || '—'}</div>
            </div>
          </div>
          <div className="pt-2">
          <Button variant="outline" className="mt-2 w-full text-xs" onClick={handleViewProfile}>
            View Profile
          </Button>


          <Button variant="default" className="mt-2 w-full text-xs" onClick={handleViewDetails}>
            View Details
          </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// --- ADD TRADITION FORM ---
function AddTraditionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // TODO: Implement form submission logic
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">Tradition Name</label>
        <Input id="name" placeholder="Enter tradition name" required />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="type" className="text-sm font-medium">Type</label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ritual">Ritual</SelectItem>
              <SelectItem value="craft">Craft</SelectItem>
              <SelectItem value="oral">Oral Tradition</SelectItem>
              <SelectItem value="dance">Dance</SelectItem>
              <SelectItem value="festival">Festival</SelectItem>
              <SelectItem value="music">Music</SelectItem>
              <SelectItem value="cuisine">Cuisine</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label htmlFor="materials" className="text-sm font-medium">Associated Materials</label>
          <Input id="materials" placeholder="Enter materials" />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">Description</label>
        <textarea
          id="description"
          placeholder="Enter tradition description"
          className="w-full min-h-[100px] p-2 border rounded-md text-sm"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add Tradition'}
        </Button>
      </div>
    </form>
  );
}

// --- MAIN PAGE ---
export default function TraditionsPage() {
  const [traditions, setTraditions] = useState<Tradition[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    materials: '',
  });

  const pageSize = 10;

  const fetchTraditions = useCallback(async (page = 1, search = '', filterParams = {}) => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      let url = `http://0.0.0.0:8000/cidoc/traditions/?limit=${pageSize}&offset=${offset}`;
      
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

      const res = await fetch(url, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch traditions');
      const data: TraditionResponse = await res.json();
      setTraditions(data.results || []);
      setTotalPages(Math.max(1, Math.ceil((data.count || data.results.length) / pageSize)));
      setCurrentPage(page);
    } catch (err) {
      console.error(err);
      setTraditions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTraditions(1);
  }, [fetchTraditions]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    fetchTraditions(1, value, filters);
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchTraditions(1, searchTerm, newFilters);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ type: 'all', materials: '' });
    fetchTraditions(1);
  };

  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Traditions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start justify-between">
          <div className="flex-1">
            <CardDescription>
              Represents intangible cultural heritage, including rituals, crafts, oral stories, dances, festivals, or other practices passed down through generations.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <Button asChild variant="outline" size="sm">
                <a href="https://example.com/exhibition-model" target="_blank" rel="noopener noreferrer">
                  Tradition Model Docs
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="https://example.com/exhibition-curation" target="_blank" rel="noopener noreferrer">
                  Tradition Curation Docs
                </a>
              </Button>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Tradition
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add New Tradition</DialogTitle>
                  <DialogDescription>
                    Add a new cultural tradition to the database. Fill in the required information below.
                  </DialogDescription>
                </DialogHeader>
                <AddTraditionForm />
              </DialogContent>
            </Dialog>
          </div>
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
                placeholder="Search traditions..."
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
                  Type
                </label>
                <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="ritual">Ritual</SelectItem>
                    <SelectItem value="craft">Craft</SelectItem>
                    <SelectItem value="oral">Oral Tradition</SelectItem>
                    <SelectItem value="dance">Dance</SelectItem>
                    <SelectItem value="festival">Festival</SelectItem>
                    <SelectItem value="music">Music</SelectItem>
                    <SelectItem value="cuisine">Cuisine</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-3 w-3" />
                  Materials
                </label>
                <Input
                  placeholder="Filter by materials"
                  value={filters.materials}
                  onChange={(e) => handleFilterChange('materials', e.target.value)}
                />
              </div>
            </div>

            {/* Clear Filters */}
            {(searchTerm || filters.type !== 'all' || filters.materials) && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear all filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Traditions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Traditions Table</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading traditions...</div>
          ) : traditions.length === 0 ? (
            <div className="text-center py-8">No traditions found.</div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Practitioners</TableHead>
                      <TableHead>Artifacts</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Materials</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {traditions.map((t) => (
                      <TraditionHoverCard key={t.id} tradition={t}>
                        <TableRow className="cursor-pointer">
                          <TableCell>{t.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{t.type}</Badge>
                          </TableCell>
                          <TableCell>{t.practitioners.length || '—'}</TableCell>
                          <TableCell>{t.artifacts_used.length || '—'}</TableCell>
                          <TableCell>{t.associated_events.length || '—'}</TableCell>
                          <TableCell>{t.associated_materials || '—'}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                alert('View tradition details');
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      </TraditionHoverCard>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => fetchTraditions(page, searchTerm, filters)}
                  className="mt-4"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}