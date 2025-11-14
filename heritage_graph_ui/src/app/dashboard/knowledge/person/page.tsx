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
import { Label } from '@/components/ui/label';
import { toast, Toaster } from 'sonner';
import { useSession } from 'next-auth/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { 
  Clock, 
  Calendar,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';

// --- TYPES ---
type Category = 'monument' | 'festival' | 'ritual' | 'tradition' | 'artifact' | 'other';
type Status = 'pending_review' | 'approved' | 'rejected';

interface Contributor {
  username: string;
}

interface CidocPerson {
  id: number;
  name: string;
  aliases?: string;
  birth_date?: string;
  death_date?: string;
  occupation?: string;
  biography?: string;
  historical_period?: string | null;
}

interface CidocPersonResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CidocPerson[];
}

interface DisplayPerson {
  entity_id: string;
  name: string;
  description?: string;
  category: Category;
  status: Status | string;
  contributor: Contributor;
  created_at: string;
  raw: CidocPerson;
}

// --- INITIAL FORM STATE ---
const INITIAL_FORM_STATE = {
  name: '',
  description: '',
  category: 'artifact' as Category,
  form_data: {} as Record<string, any>,
};

// --- PAGINATION COMPONENT ---
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  const pages: number[] = [];
  const maxVisiblePages = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  if (endPage - startPage + 1 < maxVisiblePages) startPage = Math.max(1, endPage - maxVisiblePages + 1);

  for (let i = startPage; i <= endPage; i++) pages.push(i);

  return (
    <div className={`flex items-center justify-between px-2 ${className}`}>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <div className="flex items-center space-x-1">
          {startPage > 1 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onPageChange(1)} className="h-8 w-8 p-0">1</Button>
              {startPage > 2 && <MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
            </>
          )}
          {pages.map(page => (
            <Button key={page} variant={currentPage === page ? 'default' : 'ghost'} size="sm" onClick={() => onPageChange(page)} className="h-8 w-8 p-0">{page}</Button>
          ))}
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
              <Button variant="ghost" size="sm" onClick={() => onPageChange(totalPages)} className="h-8 w-8 p-0">{totalPages}</Button>
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
    </div>
  );
}

// --- ENTITY HOVER CARD ---
function EntityHoverCard({ entity, children, currentUserSession }: { entity: DisplayPerson, children: React.ReactNode, currentUserSession?: any }) {
  const router = useRouter();
  const person = entity.raw;

  const handleViewProfile = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const username = currentUserSession?.user?.username || 'me';
    router.push(`/dashboard/users/${username}`);
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    router.push(`/dashboard/knowledge/person/view/${entity.entity_id}`);
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-96" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold">{person.name}</h4>
            {person.occupation && <Badge variant="outline">{person.occupation}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{person.biography || 'No biography available.'}</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Born: {person.birth_date || 'Unknown'}</div>
              <div className="flex items-center gap-1 mt-1"><Calendar className="h-3 w-3" /> Died: {person.death_date || '—'}</div>
            </div>
            <div>
              <div>Aliases: {person.aliases || '—'}</div>
              <div className="mt-1">Period: {person.historical_period || '—'}</div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={handleViewProfile}>View Profile</Button>
            <Button variant="default" size="sm" className="flex-1 text-xs" onClick={handleViewDetails}>View Details</Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// --- MAIN PAGE ---
export default function PersonsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isSignedIn = status === 'authenticated';

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [persons, setPersons] = useState<DisplayPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;
  const [selectedCategory, setSelectedCategory] = useState<Category>('artifact');
  const categoryOptions: Category[] = ['monument', 'festival', 'ritual', 'tradition', 'artifact', 'other'];

  const updateFormField = useCallback((field: keyof typeof INITIAL_FORM_STATE, value: any) => setFormData(prev => ({ ...prev, [field]: value })), []);
  const clearForm = useCallback(() => setFormData(INITIAL_FORM_STATE), []);

  const fetchPersons = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const res = await fetch(`http://0.0.0.0:8000/cidoc/persons/?limit=${pageSize}&offset=${offset}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data: CidocPersonResponse = await res.json();
      const normalized = data.results.map(p => ({
        entity_id: String(p.id),
        name: p.name,
        description: p.biography || '',
        category: selectedCategory,
        status: 'approved' as Status,
        contributor: { username: 'system' },
        created_at: p.birth_date || new Date().toISOString(),
        raw: p
      }));
      setPersons(normalized);
      setTotalCount(data.count);
      setTotalPages(Math.ceil(data.count / pageSize));
      setCurrentPage(page);
    } catch (err) {
      toast.error('Network error fetching persons');
      setPersons([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally { setIsLoading(false); }
  }, [pageSize, selectedCategory]);

  useEffect(() => { fetchPersons(1); }, [fetchPersons, selectedCategory]);

  const formatDate = (d: string) => { const iso = Date.parse(d); return isNaN(iso) ? d : new Date(d).toLocaleDateString(); };

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="px-4 lg:px-6 space-y-6">

        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Persons</CardTitle>
            <CardDescription>Browse notable persons from CIDOC</CardDescription>
          </CardHeader>
        </Card>

        {/* Persons Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Persons</CardTitle>
                <CardDescription>Total: {totalCount}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="category-filter" className="text-sm whitespace-nowrap">Filter</Label>
                <Select value={selectedCategory} onValueChange={(v: Category) => setSelectedCategory(v)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{categoryOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <p className="text-muted-foreground mt-2">Loading persons...</p>
              </div>
            ) : persons.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No persons found</h3>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Occupation</TableHead>
                        <TableHead>Born</TableHead>
                        <TableHead>Died</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {persons.map(entity => (
                        <EntityHoverCard key={entity.entity_id} entity={entity} currentUserSession={session}>
                          <TableRow className="cursor-pointer">
                            <TableCell>{entity.raw.name}</TableCell>
                            <TableCell><Badge variant="outline">{entity.raw.occupation || '—'}</Badge></TableCell>
                            <TableCell>{entity.raw.birth_date || 'Unknown'}</TableCell>
                            <TableCell>{entity.raw.death_date || '—'}</TableCell>
                            <TableCell>{entity.raw.historical_period || '—'}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => toast.info('Open details')}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        </EntityHoverCard>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={fetchPersons} className="mt-4" />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
