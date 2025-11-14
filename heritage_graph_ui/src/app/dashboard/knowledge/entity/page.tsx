'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { DataTable } from '@/components/heritage-table';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
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

// Original contributor type retained for UI compatibility (artifacts don't include contributor)
interface Contributor {
  id?: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

// CIDOC artifact type (fields taken from the API sample you provided)
interface CidocArtifact {
  id: number;
  name: string;
  aliases?: string;
  description?: string;
  material?: string;
  size?: string;
  weight?: string;
  date_created?: string; // e.g., "196 BCE"
  condition?: string;
  status?: string; // e.g., "on_display"
  digital_representation?: string;
  creator?: any;
  origin_location?: any;
  historical_period?: any;
  associated_events?: any[];
  documentation_sources?: any[];
}

// We still keep a "display entity" shape so we can reuse your UI (hover card expects contributor, created_at etc.)
interface DisplayArtifact {
  entity_id: string; // mapped from artifact.id
  name: string;
  description?: string;
  category: Category;
  status: Status | string; // CIDOC status is different so allow string
  contributor: Contributor;
  created_at: string; // mapped from date_created or fallback to now
  current_revision?: any;
  raw: CidocArtifact; // keep raw artifact for full use
}

interface CidocArtifactResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CidocArtifact[];
}

// --- INITIAL STATE ---
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
    <div className={`flex items-center justify-between px-2 ${className}`}>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <div className="flex items-center space-x-1">
          {startPage > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(1)}
                className="h-8 w-8 p-0"
              >
                1
              </Button>
              {startPage > 2 && <MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
            </>
          )}
          
          {pages.map(page => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "ghost"}
              size="sm"
              onClick={() => onPageChange(page)}
              className="h-8 w-8 p-0"
            >
              {page}
            </Button>
          ))}
          
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(totalPages)}
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

// --- HOVER CARD COMPONENT (adapted for artifacts) ---
interface EntityHoverCardProps {
  entity: DisplayArtifact;
  children: React.ReactNode;
  currentUserSession: any;
}

function EntityHoverCard({ entity, children, currentUserSession }: EntityHoverCardProps) {
  const router = useRouter();
  
  const handleViewProfile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // If session has username route to user's profile, otherwise to /dashboard
    const username = currentUserSession?.user?.username || 'me';
    router.push(`/dashboard/users/${username}`);
  };

  const handleViewSubmission = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/dashboard/knowledge/entity/view/${entity.entity_id}`);
  };

  const truncateDescription = (text: string, maxLength: number = 150) => {
    if (!text) return 'No description available';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const artifact = entity.raw;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-96" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold">{artifact.name}</h4>
            <Badge variant="outline" className="mt-1">
              {artifact.material || 'Unknown material'}
            </Badge>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>{truncateDescription(artifact.description || '')}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{artifact.date_created || 'Date unknown'}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <User className="h-3 w-3" />
                <span>{artifact.creator?.name || artifact.origin_location || 'Origin unknown'}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-xs">Size:</span>
                <span className="ml-1">{artifact.size || '—'}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-muted-foreground text-xs">Condition:</span>
                <span className="ml-1">{artifact.condition || '—'}</span>
              </div>
            </div>
          </div>

          {artifact.digital_representation && (
            <div className="pt-2">
              <a
                href={artifact.digital_representation}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline"
              >
                View digital representation
              </a>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 text-xs"
              onClick={handleViewProfile}
            >
              View Profile
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1 text-xs"
              onClick={handleViewSubmission}
            >
              View Details
            </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default function CulturalEntitiesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isSignedIn = status === 'authenticated';

  // --- FORM STATE ---
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // --- ARTIFACTS STATE (replacing pending entities) ---
  const [artifacts, setArtifacts] = useState<DisplayArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category>('artifact');
  
  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const categoryOptions: Category[] = ['monument', 'festival', 'ritual', 'tradition', 'artifact', 'other'];

  // --- FORM HANDLERS ---
  const updateFormField = useCallback((field: keyof typeof INITIAL_FORM_STATE, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const clearForm = useCallback(() => {
    setFormData(INITIAL_FORM_STATE);
    toast.info('Form cleared');
  }, []);

  // --- FETCH ARTIFACTS (CIDOC API) ---
  const fetchArtifacts = useCallback(async (page: number = 1) => {
    // allow viewing even when not signed in; your original code restricted it
    setIsLoading(true);

    try {
      const offset = (page - 1) * pageSize;
      const url = `http://0.0.0.0:8000/cidoc/artifacts/?limit=${pageSize}&offset=${offset}`;

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        console.error('Failed to fetch artifacts', res.statusText);
        toast.error('Failed to load artifacts');
        setArtifacts([]);
        setTotalCount(0);
        setTotalPages(1);
        return;
      }

      const data: CidocArtifactResponse = await res.json();

      // Normalize artifacts into DisplayArtifact so UI keeps working
      const normalized: DisplayArtifact[] = data.results.map((a) => {
        // map date_created to an ISO-like string for created_at; if it's historic like "196 BCE" keep raw string as created_at
        const createdAt = a.date_created ? String(a.date_created) : new Date().toISOString();

        // contributor placeholder - CIDOC artifacts don't have a contributor; keep UI stable
        const contributor: Contributor = {
          username: a.creator?.username || a.creator?.name || 'system',
        };

        // status mapping: map CIDOC status to your Status type as best-effort
        const statusMap: Record<string, Status> = {
          pending_review: 'pending_review',
          approved: 'approved',
          rejected: 'rejected',
        };

        const mappedStatus = (a.status && statusMap[a.status]) ? statusMap[a.status] : 'approved';

        return {
          entity_id: String(a.id),
          name: a.name,
          description: a.description || '',
          category: 'artifact' as Category,
          status: mappedStatus,
          contributor,
          created_at: createdAt,
          current_revision: null,
          raw: a,
        };
      });

      setArtifacts(normalized);
      setTotalCount(data.count || normalized.length);
      setTotalPages(Math.max(1, Math.ceil((data.count || normalized.length) / pageSize)));
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching artifacts:', err);
      toast.error('Network error while loading artifacts');
      setArtifacts([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  // Load artifacts on mount and when page/category change
  useEffect(() => {
    setCurrentPage(1);
    fetchArtifacts(1);
  }, [fetchArtifacts, selectedCategory]);

  // Handle page change
  const handlePageChange = (page: number) => {
    fetchArtifacts(page);
  };

  // --- VALIDATION & SUBMISSION (kept from original; posting behavior left pointing to cultural-entities) ---
  const validateForm = useCallback((): boolean => {
    if (!formData.name.trim()) {
      toast.error('Please provide a Name.');
      return false;
    }
    if (!formData.description.trim()) {
      toast.error('Please provide a Description.');
      return false;
    }
    if (!formData.category) {
      toast.error('Please select a Category.');
      return false;
    }
    return true;
  }, [formData]);

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!isSignedIn) {
      toast.error('Please sign in to submit contributions.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = (session as any)?.accessToken;

      const res = await fetch('http://0.0.0.0:8000/data/api/cultural-entities/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category,
          form_data: formData.form_data,
        }),
      });

      if (res.ok) {
        const responseData = await res.json();
        toast.success(`"${formData.name}" submitted successfully!`);
        
        // refresh list (keep current page)
        fetchArtifacts(currentPage);
        
        setIsDialogOpen(false);
        clearForm();
      } else {
        const errorData = await res.json().catch(() => null);
        console.error('Submission error details:', errorData);
        toast.error(errorData?.detail || errorData?.message || 'Submission failed. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      toast.error('Network error. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- STATUS BADGE (kept but simple) ---
  const getStatusBadge = (status: Status | string) => {
    const statusConfig: Record<string, { label: string; icon: any; variant: any }> = {
      pending_review: { label: 'Pending Review', icon: Clock, variant: 'secondary' },
      approved: { label: 'Approved', icon: CheckCircle, variant: 'default' },
      rejected: { label: 'Rejected', icon: XCircle, variant: 'destructive' },
    };
    
    const key = (status as string) in statusConfig ? (status as string) : 'approved';
    const config = statusConfig[key];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Format date - if it's a historic label like "196 BCE" return as-is
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    // try to parse ISO; if it fails, return original (e.g., "196 BCE")
    const maybeIso = Date.parse(dateString);
    if (isNaN(maybeIso)) return dateString;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="px-4 lg:px-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Cultural Entity</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
            {/* Description column */}
            <div className="flex-1">
              <CardDescription className="text-base">
                This view displays artifacts from the CIDOC API. Columns have been updated to show artifact-specific metadata (material, size, condition, date created, and a link to any digital representation).
              </CardDescription>
            </div>

            {/* Links / Actions column */}
            <div className="flex flex-col gap-3 md:w-48">
<Button
  className="flex items-center gap-2"
  onClick={() => router.push('/dashboard/contribute/entity/')}
>
  <Plus className="h-4 w-4" />
  Add Cultural Entity
</Button>

              <Button asChild variant="outline" size="sm">
                <a
                  href="https://example.com/source-model"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Cultural Entity Model Docs
                </a>
              </Button>

              <Button asChild variant="outline" size="sm">
                <a
                  href="https://example.com/source-curation"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Cultural Entity Curation Docs
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Artifacts Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Artifacts</CardTitle>
                <CardDescription>
                  Artifacts from CIDOC. Showing: {selectedCategory}
                  {totalCount > 0 && ` (${totalCount} total)`}
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="category-filter" className="text-sm whitespace-nowrap">
                  Filter (client)
                </Label>
                <Select
                  value={selectedCategory}
                  onValueChange={(value: Category) => setSelectedCategory(value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <p className="text-muted-foreground mt-2">Loading artifacts...</p>
              </div>
            ) : artifacts.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No artifacts found</h3>
                <p className="text-muted-foreground">
                  There are no artifacts to show for the selected filter.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {artifacts.map((entity) => (
                        <EntityHoverCard 
                          key={entity.entity_id} 
                          entity={entity}
                          currentUserSession={session}
                        >
                          <TableRow className="cursor-pointer">
                            <TableCell className="font-medium">{entity.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {entity.raw.material || 'Unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{entity.raw.size || '—'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{formatDate(entity.created_at)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{entity.raw.condition || '—'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // open digital representation if available
                                    const url = entity.raw.digital_representation;
                                    if (url) window.open(url, '_blank', 'noopener');
                                    else toast.info('No digital representation available');
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        </EntityHoverCard>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    className="mt-4"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </>
  );
}
