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

interface Contributor {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface CulturalEntity {
  entity_id: string;
  name: string;
  description?: string;
  category: Category;
  status: Status;
  contributor: Contributor;
  created_at: string;
  current_revision: any;
}

interface CulturalEntitiesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CulturalEntity[];
}

// --- INITIAL STATE ---
const INITIAL_FORM_STATE = {
  name: '',
  description: '',
  category: 'monument' as Category,
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
          onClick={() => onPageChange(currentPage - 1)}
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
          onClick={() => onPageChange(currentPage + 1)}
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

// --- HOVER CARD COMPONENT ---
interface EntityHoverCardProps {
  entity: CulturalEntity;
  children: React.ReactNode;
  currentUserSession: any; // Add session as prop
}

function EntityHoverCard({ entity, children, currentUserSession }: EntityHoverCardProps) {
  const router = useRouter();
  
  const handleViewProfile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Use the session passed as prop instead of calling useSession hook
    router.push(`/dashboard/users/${currentUserSession?.user?.username}`);
  };

  const handleViewSubmission = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/dashboard/knowledge/viewreport/${entity.entity_id}`);
  };

  const truncateDescription = (text: string, maxLength: number = 150) => {
    if (!text) return 'No description available';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold">{entity.name}</h4>
            <Badge variant="outline" className="mt-1">
              {entity.category}
            </Badge>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>{truncateDescription(entity.description || entity.current_revision?.description || '')}</p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{entity.contributor.username}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{new Date(entity.created_at).toLocaleDateString()}</span>
            </div>
          </div>

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
              View Submission
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

  // --- PENDING ENTITIES STATE ---
  const [pendingEntities, setPendingEntities] = useState<CulturalEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category>('monument');
  
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

  // --- FETCH PENDING ENTITIES ---
  const fetchPendingEntities = useCallback(async (category: Category = 'monument', page: number = 1) => {
    if (!isSignedIn) return;
    
    setIsLoading(true);
    try {
      const token = (session as any)?.accessToken;
      const offset = (page - 1) * pageSize;
      
      const res = await fetch(
        `http://0.0.0.0:8000/data/api/cultural-entities/?category=${category}&status=pending_review&limit=${pageSize}&offset=${offset}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (res.ok) {
        const data: CulturalEntitiesResponse = await res.json();
        setPendingEntities(data.results);
        setTotalCount(data.count);
        setTotalPages(Math.ceil(data.count / pageSize));
        setCurrentPage(page);
      } else {
        console.error('Failed to fetch pending entities');
        toast.error('Failed to load pending entities');
      }
    } catch (err) {
      console.error('Error fetching pending entities:', err);
      toast.error('Error loading pending entities');
    } finally {
      setIsLoading(false);
    }
  }, [session, isSignedIn, pageSize]);

  // Load pending entities when component mounts or category changes
  useEffect(() => {
    if (isSignedIn) {
      setCurrentPage(1); // Reset to first page when category changes
      fetchPendingEntities(selectedCategory, 1);
    }
  }, [fetchPendingEntities, selectedCategory, isSignedIn]);

  // Handle page change
  const handlePageChange = (page: number) => {
    fetchPendingEntities(selectedCategory, page);
  };

  // --- VALIDATION ---
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

  // --- SUBMIT ---
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
        
        // Refresh the pending entities list
        fetchPendingEntities(selectedCategory, currentPage);
        
        // Close dialog and clear form
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

  // --- STATUS BADGE ---
  const getStatusBadge = (status: Status) => {
    const statusConfig = {
      pending_review: { label: 'Pending Review', icon: Clock, variant: 'secondary' as const },
      approved: { label: 'Approved', icon: CheckCircle, variant: 'default' as const },
      rejected: { label: 'Rejected', icon: XCircle, variant: 'destructive' as const },
    };
    
    const config = statusConfig[status];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // --- DATE FORMATTING ---
  const formatDate = (dateString: string) => {
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
            <CardTitle className="text-2xl font-bold">Cultural Entities</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
            {/* Description column */}
            <div className="flex-1">
              <CardDescription className="text-base">
                Cultural entities represent tangible or intangible heritage objects, 
                institutions, or concepts that embody the identity, history, or 
                traditions of a culture. Examples include artifacts, monuments, 
                historical sites, and collections that are documented, preserved, 
                and studied to understand cultural heritage.
              </CardDescription>
            </div>

            {/* Links column */}
            <div className="flex flex-col gap-3 md:w-48">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Cultural Entity
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Cultural Entity</DialogTitle>
                  </DialogHeader>
                  
                  {/* Form Content */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => updateFormField('name', e.target.value)}
                        placeholder="E.g., Pashupatinath Temple, Dashain Festival, Malla Period Artifact"
                        disabled={!isSignedIn}
                      />
                    </div>

                    <div>
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => updateFormField('category', value as Category)}
                        disabled={!isSignedIn}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
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

                    <div>
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => updateFormField('description', e.target.value)}
                        rows={6}
                        placeholder="Provide a comprehensive description of the cultural entity, its historical significance, cultural importance, and any relevant details..."
                        disabled={!isSignedIn}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setIsDialogOpen(false);
                          clearForm();
                        }}
                        disabled={!isSignedIn}
                      >
                        Cancel
                      </Button>

                      <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !isSignedIn} 
                        className="min-w-32"
                      >
                        {!isSignedIn ? (
                          'Sign In to Submit'
                        ) : isSubmitting ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Entity'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

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

        {/* Pending Entities Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Pending Review</CardTitle>
                <CardDescription>
                  Cultural entities waiting for approval. Currently showing: {selectedCategory}
                  {totalCount > 0 && ` (${totalCount} total)`}
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="category-filter" className="text-sm whitespace-nowrap">
                  Filter by category:
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
            {!isSignedIn ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Please sign in to view pending entities.</p>
              </div>
            ) : isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <p className="text-muted-foreground mt-2">Loading pending entities...</p>
              </div>
            ) : pendingEntities.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No pending entities</h3>
                <p className="text-muted-foreground">
                  There are no {selectedCategory} entities waiting for review.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Contributor</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingEntities.map((entity) => (
                        <EntityHoverCard 
                          key={entity.entity_id} 
                          entity={entity}
                          currentUserSession={session} // Pass session as prop
                        >
                          <TableRow className="cursor-pointer">
                            <TableCell className="font-medium">{entity.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {entity.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(entity.status)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{entity.contributor.username}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{formatDate(entity.created_at)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
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