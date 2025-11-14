'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { MoreHorizontal, Eye, Calendar, User, Plus, Search, Filter } from 'lucide-react';

// --- Types ---
interface Source {
  id: number;
  title: string;
  authors: string;
  publication_year: string;
  type: string;
  digital_link: string;
  archive_location: string;
  documented_persons: number[];
}

interface SourceResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Source[];
}

// --- Pagination ---
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

// --- Hover Card ---
interface SourceHoverProps {
  source: Source;
  children: React.ReactNode;
}

function SourceHoverCard({ source, children }: SourceHoverCard) {
  const router = useRouter();

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>

      <HoverCardContent className="w-96" align="start">
        <div className="space-y-2">
          <h4 className="font-semibold">{source.title}</h4>
          <p className="text-sm text-muted-foreground">{source.authors}</p>

          <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
            <Badge variant="outline">{source.type}</Badge>
            <Badge variant="outline">{source.publication_year}</Badge>
          </div>

          <div className="text-xs pt-1">
            <div>
              <Calendar className="inline h-3 w-3 mr-1 text-muted-foreground" />
              Archive: {source.archive_location || "—"}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <User className="h-3 w-3 text-muted-foreground" />
              Documented Persons: {source.documented_persons.length || "—"}
            </div>
          </div>

          {source.digital_link && (
            <a
              href={source.digital_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline text-xs block mt-2"
            >
              View Digital Source
            </a>
          )}

          {/* ✔ BUTTONS MOVED INTO HOVER CARD */}
          <div className="flex gap-2 pt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() =>
                router.push(`/dashboard/knowledge/source/view/${source.id}`)
              }
            >
              View Profile
            </Button>

            <Button
              size="sm"
              className="flex-1 text-xs"
              onClick={() =>
                router.push(`/dashboard/knowledge/source/view/${source.id}`)
              }
            >
              View Details
            </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}


// --- Add Cultural Entity Form ---
function AddCulturalEntityForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* form trimmed for brevity */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline">Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add Cultural Entity'}
        </Button>
      </div>
    </form>
  );
}

// --- Main Page ---
export default function SourcesPage() {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    year: '',
    author: '',
  });

  const pageSize = 10;

  const fetchSources = useCallback(async (page = 1, search = '', filterParams = {}) => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      let url = `http://0.0.0.0:8000/cidoc/sources/?limit=${pageSize}&offset=${offset}`;

      if (search) url += `&search=${encodeURIComponent(search)}`;
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value && value !== 'all') url += `&${key}=${encodeURIComponent(value)}`;
      });

      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('Failed to fetch sources');
      const data: SourceResponse = await res.json();

      setSources(data.results || []);
      setTotalPages(Math.max(1, Math.ceil((data.count || data.results.length) / pageSize)));
      setCurrentPage(page);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources(1);
  }, [fetchSources]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    fetchSources(1, value, filters);
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchSources(1, searchTerm, newFilters);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ type: 'all', year: '', author: '' });
    fetchSources(1);
  };

  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Sources</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start justify-between">
          <CardDescription>
            All documented sources from the CIDOC API including journals, books, archival materials, and digital links.
          </CardDescription>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Cultural Entity
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Cultural Entity</DialogTitle>
                <DialogDescription>
                  Add a new cultural entity to the database.
                </DialogDescription>
              </DialogHeader>
              <AddCulturalEntityForm />
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Search + Filters */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Search & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search across all columns..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <SelectItem value="journal">Journal</SelectItem>
                    <SelectItem value="book">Book</SelectItem>
                    <SelectItem value="archive">Archive</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-3 w-3" />
                  Year
                </label>
                <Input
                  placeholder="Filter by year"
                  value={filters.year}
                  onChange={(e) => handleFilterChange('year', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-3 w-3" />
                  Author
                </label>
                <Input
                  placeholder="Filter by author"
                  value={filters.author}
                  onChange={(e) => handleFilterChange('author', e.target.value)}
                />
              </div>
            </div>

            {(searchTerm || filters.type !== 'all' || filters.year || filters.author) && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear all filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card> */}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sources Table</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading sources...</div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8">No sources found.</div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Authors</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Digital Link</TableHead>
                      <TableHead>Archive Location</TableHead>
                      <TableHead>Documented Persons</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {sources.map((s) => (
                      <SourceHoverCard key={s.id} source={s}>
                        <TableRow className="hover:bg-muted transition">
                          <TableCell>{s.id}</TableCell>
                          <TableCell className="font-medium">{s.title}</TableCell>
                          <TableCell>{s.authors}</TableCell>
                          <TableCell>{s.publication_year}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{s.type}</Badge>
                          </TableCell>
                          <TableCell>
                            {s.digital_link ? (
                              <a
                                href={s.digital_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                              >
                                <Eye className="inline h-4 w-4 mr-1" />
                                Link
                              </a>
                            ) : '—'}
                          </TableCell>
                          <TableCell>{s.archive_location || '—'}</TableCell>
                          <TableCell>{s.documented_persons.length || '—'}</TableCell>

                          {/* --- ACTION BUTTONS --- */}
                          {/* <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(`/dashboard/knowledge/source/view/${s.id}`)}
                              >
                                View Profile
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => router.push(`/dashboard/knowledge/viewreport/${s.id}`)}
                              >
                                View Details
                              </Button>
                            </div>
                          </TableCell> */}
                        </TableRow>
                      </SourceHoverCard>
                    ))}
                  </TableBody>

                </Table>
              </div>

              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => fetchSources(page, searchTerm, filters)}
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
