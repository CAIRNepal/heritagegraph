"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Clock,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
} from "lucide-react";

import type { OntologyClass, OntologyColumn } from "@/lib/ontology/types";

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// PAGINATION
// ---------------------------------------------------------------------------
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages: number[] = [];
  const maxVisible = 5;

  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between px-2">
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
          {start > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(1)}
                className="h-8 w-8 p-0"
              >
                1
              </Button>
              {start > 2 && (
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              )}
            </>
          )}
          {pages.map((page) => (
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
          {end < totalPages && (
            <>
              {end < totalPages - 1 && (
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              )}
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
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CELL RENDERER
// ---------------------------------------------------------------------------
function CellValue({
  column,
  value,
}: {
  column: OntologyColumn;
  value: any;
}) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  switch (column.format) {
    case "badge":
      return <Badge variant="outline">{String(value)}</Badge>;
    case "link":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline text-sm"
        >
          Link
        </a>
      );
    case "date":
      try {
        const d = new Date(value);
        return <span>{isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()}</span>;
      } catch {
        return <span>{String(value)}</span>;
      }
    default:
      return <span className="truncate max-w-48 inline-block">{String(value)}</span>;
  }
}

// ---------------------------------------------------------------------------
// ROW HOVER CARD — shows all field values for a record
// ---------------------------------------------------------------------------
function RowHoverCard({
  record,
  ontologyClass,
  children,
}: {
  record: Record<string, any>;
  ontologyClass: OntologyClass;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const displayName =
    record.name || record.title || `#${record.id}`;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-96" align="start">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">{displayName}</h4>

          {/* Show first 6 non-empty fields */}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            {ontologyClass.fields
              .filter(
                (f) =>
                  record[f.key] !== undefined &&
                  record[f.key] !== null &&
                  record[f.key] !== ""
              )
              .slice(0, 6)
              .map((f) => (
                <div key={f.key}>
                  <span className="font-medium">{f.label}:</span>{" "}
                  {String(record[f.key]).substring(0, 60)}
                </div>
              ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1 text-xs"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(
                  `/dashboard/knowledge/${ontologyClass.key}/view/${record.id}`
                );
              }}
            >
              <Eye className="h-3 w-3 mr-1" /> View Details
            </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT — OntologyDataTable
// ---------------------------------------------------------------------------
export interface OntologyDataTableProps {
  /** Ontology class definition driving the table */
  ontologyClass: OntologyClass;
  /** Override API base URL */
  apiBaseUrl?: string;
  /** Path to create-new form */
  contributePath?: string;
  /** Title override */
  title?: string;
  /** Description override */
  description?: string;
}

export default function OntologyDataTable({
  ontologyClass,
  apiBaseUrl,
  contributePath,
  title,
  description,
}: OntologyDataTableProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const baseUrl = apiBaseUrl || API_BASE_URL;
  const endpoint = `${baseUrl}${ontologyClass.apiEndpoint}`;
  const newPath =
    contributePath || `/dashboard/contribute/${ontologyClass.key}`;

  const visibleColumns = ontologyClass.columns.filter(
    (c) => c.visible !== false
  );

  // --- STATE ---
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // --- FETCH ---
  const fetchRecords = useCallback(
    async (page: number = 1) => {
      setIsLoading(true);
      try {
        const offset = (page - 1) * PAGE_SIZE;
        let url = `${endpoint}?limit=${PAGE_SIZE}&offset=${offset}`;
        if (searchQuery.trim()) {
          url += `&search=${encodeURIComponent(searchQuery.trim())}`;
        }

        const token = (session as any)?.accessToken;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();

        // Handle both paginated (DRF) and plain array responses
        if (Array.isArray(data)) {
          setRecords(data);
          setTotalCount(data.length);
          setTotalPages(1);
        } else {
          setRecords(data.results || []);
          setTotalCount(data.count || 0);
          setTotalPages(Math.ceil((data.count || 0) / PAGE_SIZE));
        }

        setCurrentPage(page);
      } catch (err) {
        console.error("Fetch error:", err);
        toast.error(`Failed to load ${ontologyClass.labelPlural.toLowerCase()}`);
        setRecords([]);
        setTotalCount(0);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint, searchQuery, session, ontologyClass.labelPlural]
  );

  useEffect(() => {
    fetchRecords(1);
  }, [fetchRecords]);

  // --- RENDER ---
  return (
    <>

      <div className="px-4 lg:px-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold">
                  {title || ontologyClass.labelPlural}
                </CardTitle>
                <CardDescription>
                  {description ||
                    ontologyClass.description ||
                    `Browse ${ontologyClass.labelPlural.toLowerCase()} in the knowledge base.`}
                </CardDescription>
              </div>
              <Button
                onClick={() => router.push(newPath)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" /> Add{" "}
                {ontologyClass.label}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Table Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardDescription>Total: {totalCount}</CardDescription>
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${ontologyClass.labelPlural.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchRecords(1)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-muted-foreground mt-2">
                  Loading {ontologyClass.labelPlural.toLowerCase()}…
                </p>
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  No {ontologyClass.labelPlural.toLowerCase()} found
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Be the first to contribute!
                </p>
                <Button onClick={() => router.push(newPath)}>
                  <Plus className="h-4 w-4 mr-1" /> Add{" "}
                  {ontologyClass.label}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {visibleColumns.map((col) => (
                          <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <RowHoverCard
                          key={record.id}
                          record={record}
                          ontologyClass={ontologyClass}
                        >
                          <TableRow className="cursor-pointer">
                            {visibleColumns.map((col) => (
                              <TableCell key={col.key}>
                                <CellValue
                                  column={col}
                                  value={record[col.key]}
                                />
                              </TableCell>
                            ))}
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(
                                    `/dashboard/knowledge/${ontologyClass.key}/view/${record.id}`
                                  );
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        </RowHoverCard>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={fetchRecords}
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
