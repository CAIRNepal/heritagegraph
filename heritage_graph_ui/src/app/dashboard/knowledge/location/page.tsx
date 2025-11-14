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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Clock,
  Eye,
  Calendar,
  MapPin,
  Compass,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { useSession } from 'next-auth/react';

// -------------------------------------------------------------
//                       TYPES
// -------------------------------------------------------------

interface CidocLocation {
  id: number;
  name: string;
  coordinates: string;
  type: string;
  description: string;
  current_status: string;
  historical_period: string | null;
}

interface CidocLocationResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CidocLocation[];
}

interface DisplayLocation {
  entity_id: string;
  name: string;
  category: string;
  contributor: { username: string };
  status: string;
  created_at: string;
  raw: CidocLocation;
}

// -------------------------------------------------------------
//                   PAGINATION COMPONENT
// -------------------------------------------------------------

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  const pages = [];
  const maxVisible = 5;

  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) pages.push(i);

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
          {start > 1 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onPageChange(1)} className="h-8 w-8 p-0">
                1
              </Button>
              {start > 2 && <MoreHorizontal className="h-4 w-4" />}
            </>
          )}

          {pages.map((p) => (
            <Button
              key={p}
              variant={currentPage === p ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPageChange(p)}
              className="h-8 w-8 p-0"
            >
              {p}
            </Button>
          ))}

          {end < totalPages && (
            <>
              {end < totalPages - 1 && <MoreHorizontal className="h-4 w-4" />}
              <Button variant="ghost" size="sm" onClick={() => onPageChange(totalPages)} className="h-8 w-8 p-0">
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

// -------------------------------------------------------------
//                   HOVER CARD FOR LOCATIONS
// -------------------------------------------------------------



function EntityHoverCard({
  entity,
  children,
}: {
  entity: DisplayLocation;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const loc = entity.raw;

  const handleViewProfile = () => {
    router.push(`/dashboard/knowledge/location/view/${entity.entity_id}`);
  };

  const handleViewDetails = () => {
    router.push(`/dashboard/knowledge/location/view/${entity.entity_id}`);
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>

      <HoverCardContent className="w-96" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">{loc.name}</h4>
            <Badge variant="outline">{loc.type}</Badge>
          </div>

          <p className="text-sm text-muted-foreground">{loc.description || 'No description'}</p>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>{loc.coordinates || 'No coordinates'}</span>
            </div>

            <div className="flex items-center gap-1">
              <Compass className="h-3 w-3" />
              <span>Status: {loc.current_status}</span>
            </div>

            <div className="flex items-center gap-1 col-span-2">
              <Calendar className="h-3 w-3" />
              <span>Period: {loc.historical_period || '—'}</span>
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
              onClick={handleViewDetails}
            >
              View Details
            </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}


// -------------------------------------------------------------
//                       MAIN PAGE
// -------------------------------------------------------------

export default function LocationsPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [locations, setLocations] = useState<DisplayLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const pageSize = 10;
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLocations = useCallback(async (page = 1) => {
    setIsLoading(true);

    try {
      const offset = (page - 1) * pageSize;

      const res = await fetch(`http://0.0.0.0:8000/cidoc/locations/?limit=${pageSize}&offset=${offset}`);

      if (!res.ok) {
        toast.error('Failed to load locations');
        return;
      }

      const data: CidocLocationResponse = await res.json();

      const normalized: DisplayLocation[] = data.results.map((l) => ({
        entity_id: String(l.id),
        name: l.name,
        category: l.type,
        contributor: { username: 'system' },
        status: 'approved',
        created_at: new Date().toISOString(),
        raw: l,
      }));

      setLocations(normalized);
      setTotalCount(data.count);
      setTotalPages(Math.ceil(data.count / pageSize));
      setCurrentPage(page);
    } catch (err) {
      toast.error('Network error fetching locations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations(1);
  }, [fetchLocations]);

  return (
    <>
      <Toaster position="top-right" richColors />

      <div className="px-4 lg:px-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">CIDOC Locations</CardTitle>
            <CardDescription>Viewing locations from the CIDOC API.</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
            <CardDescription>Total: {totalCount}</CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <p className="text-muted-foreground mt-2">Loading locations...</p>
              </div>
            ) : locations.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No locations found</h3>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {locations.map((entity) => (
                        <EntityHoverCard key={entity.entity_id} entity={entity}>
                          <TableRow className="cursor-pointer">
                            <TableCell>{entity.raw.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{entity.raw.type}</Badge>
                            </TableCell>
                            <TableCell>{entity.raw.current_status || '—'}</TableCell>
                            <TableCell>{entity.raw.historical_period || '—'}</TableCell>

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

                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => fetchLocations(p)}
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
