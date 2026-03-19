"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  Building2,
  Flame,
  Shield,
  Clock,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  MessageSquare,
  Network,
  FileText,
  ChevronRight,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://backend.localhost";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface Assertion {
  id: string;
  content_type: number;
  content_type_name: string;
  object_id: number;
  asserted_property: string;
  asserted_value: string;
  assertion_content: string;
  source: {
    id: string;
    name: string;
    source_type: string;
    citation: string;
    url: string;
  } | null;
  source_citation: string;
  contributed_by: string;
  confidence: "certain" | "likely" | "uncertain" | "speculative";
  data_quality_note: string;
  reconciliation_status: "pending" | "accepted" | "disputed" | "superseded";
  supersedes: string | null;
  created_at: string;
  updated_at: string;
}

interface StructureRecord {
  id: number;
  name: string;
  description: string;
  structure_type: string;
  architectural_style: string;
  construction_date: string;
  location_name: string;
  coordinates: string;
  existence_status: string;
  condition: string;
  note: string;
  created_at: string;
  updated_at: string;
  assertions?: Assertion[];
  [key: string]: unknown;
}

interface LinkedEvent {
  id: number;
  name: string;
  ritual_type?: string;
  date?: string;
  recurrence_pattern?: string;
  location_name?: string;
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function confidenceColor(c: string): string {
  switch (c) {
    case "certain":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "likely":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "uncertain":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "speculative":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "";
  }
}

function statusIcon(s: string) {
  switch (s) {
    case "accepted":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "disputed":
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case "superseded":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    default:
      return <HelpCircle className="h-4 w-4 text-blue-600" />;
  }
}

function existenceStatusBadge(status: string) {
  const variant =
    status === "extant"
      ? "default"
      : status === "destroyed"
        ? "destructive"
        : status === "damaged"
          ? "secondary"
          : "outline";
  return (
    <Badge variant={variant} className="capitalize">
      {status.replace(/_/g, " ") || "Unknown"}
    </Badge>
  );
}

function conditionBadge(condition: string) {
  if (!condition) return null;
  const colorMap: Record<string, string> = {
    excellent: "bg-green-100 text-green-800",
    good: "bg-blue-100 text-blue-800",
    fair: "bg-yellow-100 text-yellow-800",
    poor: "bg-orange-100 text-orange-800",
    ruin: "bg-red-100 text-red-800",
  };
  return (
    <Badge variant="outline" className={`capitalize ${colorMap[condition] || ""}`}>
      {condition.replace(/_/g, " ")}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

export default function StructureRecordPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const id = params?.id as string;

  const [record, setRecord] = useState<StructureRecord | null>(null);
  const [assertions, setAssertions] = useState<Assertion[]>([]);
  const [linkedEvents, setLinkedEvents] = useState<LinkedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = (session as any)?.accessToken;

  // Fetch the structure record
  const fetchRecord = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `${API_BASE_URL}/cidoc/structures/${id}/`,
        { headers }
      );
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Structure not found."
            : `Failed to load (HTTP ${res.status})`
        );
      }
      const data: StructureRecord = await res.json();
      setRecord(data);

      // If assertions are embedded in the response, use them
      if (data.assertions && Array.isArray(data.assertions)) {
        setAssertions(data.assertions);
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message || "Something went wrong");
      toast.error(err.message || "Failed to load record");
    } finally {
      setIsLoading(false);
    }
  }, [id, token]);

  // Fetch assertions separately if not embedded
  const fetchAssertions = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `${API_BASE_URL}/cidoc/assertions/?entity_type=architecturalstructure&entity_id=${id}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data) ? data : data.results || [];
        setAssertions(results);
      }
    } catch {
      // Non-critical, assertions tab will show empty state
    }
  }, [id, token]);

  // Fetch linked events (rituals and festivals at this structure)
  const fetchLinkedEvents = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      // Search for rituals that mention this structure's name in location
      if (!record?.name) return;
      const res = await fetch(
        `${API_BASE_URL}/cidoc/search/?q=${encodeURIComponent(record.name)}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        // Filter to events/rituals that match this location
        const events = (Array.isArray(data) ? data : data.results || [])
          .filter(
            (item: any) =>
              (item.type === "ritual" || item.type === "festival" || item.model === "ritualevent" || item.model === "festival") &&
              item.id !== record?.id
          );
        setLinkedEvents(events);
      }
    } catch {
      // Non-critical
    }
  }, [record?.name, token]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  useEffect(() => {
    if (record && assertions.length === 0) {
      fetchAssertions();
    }
  }, [record, assertions.length, fetchAssertions]);

  useEffect(() => {
    if (record) {
      fetchLinkedEvents();
    }
  }, [record, fetchLinkedEvents]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="px-4 lg:px-6 py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground mt-4">Loading structure…</p>
      </div>
    );
  }

  // ── Error ──
  if (error || !record) {
    return (
      <div className="px-4 lg:px-6 py-12 text-center space-y-4">
        <h2 className="text-2xl font-bold">Error</h2>
        <p className="text-muted-foreground">{error || "Record not found."}</p>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/knowledge/structure")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Structures
        </Button>
      </div>
    );
  }

  // ── Derived values ──
  const acceptedAssertions = assertions.filter((a) => a.reconciliation_status === "accepted");
  const pendingAssertions = assertions.filter((a) => a.reconciliation_status === "pending");
  const disputedAssertions = assertions.filter((a) => a.reconciliation_status === "disputed");

  return (
    <>

      <div className="px-4 lg:px-6 space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/knowledge/structure")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Structures
        </Button>

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  Hero header                                          */}
        {/* ═══════════════════════════════════════════════════════ */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {/* Icon placeholder / future hero image */}
              <div className="flex-shrink-0 h-24 w-24 rounded-xl bg-muted flex items-center justify-center">
                <Building2 className="h-10 w-10 text-muted-foreground" />
              </div>

              <div className="flex-1 space-y-3">
                {/* Title */}
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {record.name}
                </h1>

                {/* Badge row */}
                <div className="flex flex-wrap gap-2">
                  {record.structure_type && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {record.structure_type}
                    </Badge>
                  )}
                  {record.architectural_style && (
                    <Badge variant="outline">
                      {record.architectural_style.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {record.existence_status &&
                    existenceStatusBadge(record.existence_status)}
                  {record.condition && conditionBadge(record.condition)}
                  {record.construction_date && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {record.construction_date}
                    </Badge>
                  )}
                </div>

                {/* Location */}
                {record.location_name && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{record.location_name}</span>
                    {record.coordinates && (
                      <span className="text-xs">({record.coordinates})</span>
                    )}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                  {record.created_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created {formatDate(record.created_at)}
                    </span>
                  )}
                  {assertions.length > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {assertions.length} claim{assertions.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push("/dashboard/contribute/structure")
                  }
                >
                  Add Info
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  Tabbed content                                       */}
        {/* ═══════════════════════════════════════════════════════ */}
        <Tabs defaultValue="about" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="about" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              About
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5">
              <Flame className="h-4 w-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="network" className="gap-1.5">
              <Network className="h-4 w-4" />
              Network
            </TabsTrigger>
            <TabsTrigger value="claims" className="gap-1.5">
              <Shield className="h-4 w-4" />
              Claims
              {assertions.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {assertions.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── About Tab ─── */}
          <TabsContent value="about" className="space-y-4 mt-4">
            <AboutTab record={record} />
          </TabsContent>

          {/* ─── Events Tab ─── */}
          <TabsContent value="events" className="space-y-4 mt-4">
            <EventsTab events={linkedEvents} router={router} />
          </TabsContent>

          {/* ─── Network Tab ─── */}
          <TabsContent value="network" className="space-y-4 mt-4">
            <NetworkTab record={record} assertions={assertions} events={linkedEvents} />
          </TabsContent>

          {/* ─── Claims Tab ─── */}
          <TabsContent value="claims" className="space-y-4 mt-4">
            <ClaimsTab
              assertions={assertions}
              accepted={acceptedAssertions}
              pending={pendingAssertions}
              disputed={disputedAssertions}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
//  ABOUT TAB
// ═══════════════════════════════════════════════════════════

function AboutTab({ record }: { record: StructureRecord }) {
  const fieldGroups = [
    {
      label: "Identity",
      fields: [
        { label: "Name", value: record.name },
        { label: "Type", value: record.structure_type },
        { label: "Architectural Style", value: record.architectural_style?.replace(/_/g, " ") },
      ],
    },
    {
      label: "History",
      fields: [
        { label: "Construction Date", value: record.construction_date },
        { label: "Existence Status", value: record.existence_status?.replace(/_/g, " ") },
        { label: "Condition", value: record.condition?.replace(/_/g, " ") },
      ],
    },
    {
      label: "Location",
      fields: [
        { label: "Place", value: record.location_name },
        { label: "Coordinates", value: record.coordinates, type: "coordinates" as const },
      ],
    },
  ];

  return (
    <>
      {/* Description */}
      {record.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {record.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Structured fields */}
      {fieldGroups.map((group) => {
        const populated = group.fields.filter((f) => f.value);
        if (populated.length === 0) return null;
        return (
          <Card key={group.label}>
            <CardHeader>
              <CardTitle className="text-lg">{group.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {populated.map((field) => (
                    <TableRow key={field.label}>
                      <TableCell className="font-medium w-1/3 text-muted-foreground">
                        {field.label}
                      </TableCell>
                      <TableCell>
                        {field.type === "coordinates" ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {field.value}
                          </span>
                        ) : (
                          <span className="capitalize">{field.value}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Notes */}
      {record.note && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {record.note}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
//  EVENTS TAB — Timeline of linked ritual events
// ═══════════════════════════════════════════════════════════

function EventsTab({
  events,
  router,
}: {
  events: LinkedEvent[];
  router: ReturnType<typeof useRouter>;
}) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <Flame className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <h3 className="text-lg font-medium">No linked events yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            No ritual events, festivals, or ceremonies have been linked to this
            structure. You can contribute one to build the knowledge graph.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/contribute/ritual")}
          >
            Add Ritual Event
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Events at this Structure
        </CardTitle>
        <CardDescription>
          Rituals, festivals, and ceremonies linked to this location
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Vertical timeline */}
        <div className="relative pl-6 border-l-2 border-muted space-y-6">
          {events.map((event, idx) => (
            <div key={event.id} className="relative group">
              {/* Timeline dot */}
              <div className="absolute -left-[calc(1.5rem+5px)] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background group-hover:bg-primary transition-colors" />

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium leading-none">
                    {event.name}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {event.ritual_type && (
                      <Badge variant="outline" className="text-xs">
                        {event.ritual_type}
                      </Badge>
                    )}
                    {event.recurrence_pattern && (
                      <Badge variant="secondary" className="text-xs">
                        {event.recurrence_pattern}
                      </Badge>
                    )}
                    {event.date && (
                      <span className="text-xs text-muted-foreground">
                        {event.date}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() =>
                    router.push(`/dashboard/knowledge/ritual/view/${event.id}`)
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
//  NETWORK TAB — Entity relationships (placeholder)
// ═══════════════════════════════════════════════════════════

function NetworkTab({
  record,
  assertions,
  events,
}: {
  record: StructureRecord;
  assertions: Assertion[];
  events: LinkedEvent[];
}) {
  // Count connections
  const uniqueContributors = new Set(
    assertions.map((a) => a.contributed_by).filter(Boolean)
  );
  const uniqueSources = new Set(
    assertions.filter((a) => a.source).map((a) => a.source!.id)
  );

  const connections = [
    { label: "Linked Events", count: events.length, icon: Flame },
    { label: "Contributors", count: uniqueContributors.size, icon: User },
    { label: "Sources", count: uniqueSources.size, icon: FileText },
    { label: "Assertions", count: assertions.length, icon: Shield },
  ];

  return (
    <div className="space-y-4">
      {/* Connection summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {connections.map((conn) => (
          <Card key={conn.label}>
            <CardContent className="pt-4 pb-4 text-center">
              <conn.icon className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold">{conn.count}</p>
              <p className="text-xs text-muted-foreground">{conn.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Graph placeholder */}
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <Network className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <h3 className="text-lg font-medium">Knowledge Graph</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            An interactive network graph showing how this structure connects to
            deities, guthis, persons, events, and other entities will appear
            here.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              /* Future: navigate to graphview filtered for this entity */
            }}
            disabled
          >
            View in Graph Explorer (Coming Soon)
          </Button>
        </CardContent>
      </Card>

      {/* Source list */}
      {uniqueSources.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sources Referenced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assertions
                .filter((a) => a.source)
                .reduce((acc: Assertion["source"][], a) => {
                  if (a.source && !acc.find((s) => s!.id === a.source!.id)) {
                    acc.push(a.source);
                  }
                  return acc;
                }, [])
                .map((source) =>
                  source ? (
                    <div
                      key={source.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg border"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{source.name}</p>
                        <Badge variant="outline" className="text-xs capitalize">
                          {source.source_type.replace(/_/g, " ")}
                        </Badge>
                        {source.citation && (
                          <p className="text-xs text-muted-foreground">
                            {source.citation}
                          </p>
                        )}
                      </div>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-xs flex-shrink-0"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Link
                        </a>
                      )}
                    </div>
                  ) : null
                )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CLAIMS TAB — Provenance & assertion tracker
// ═══════════════════════════════════════════════════════════

function ClaimsTab({
  assertions,
  accepted,
  pending,
  disputed,
}: {
  assertions: Assertion[];
  accepted: Assertion[];
  pending: Assertion[];
  disputed: Assertion[];
}) {
  if (assertions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <Shield className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <h3 className="text-lg font-medium">No claims recorded</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Every piece of information contributed to HeritageGraph is tracked as
            a claim with its source and confidence level. No claims exist for
            this record yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-xl font-bold">{accepted.length}</p>
            <p className="text-xs text-muted-foreground">Accepted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <HelpCircle className="h-5 w-5 mx-auto text-blue-600 mb-1" />
            <p className="text-xl font-bold">{pending.length}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-yellow-600 mb-1" />
            <p className="text-xl font-bold">{disputed.length}</p>
            <p className="text-xs text-muted-foreground">Disputed</p>
          </CardContent>
        </Card>
      </div>

      {/* Assertion list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Claims</CardTitle>
          <CardDescription>
            Each contribution is tracked with its source, contributor, and
            confidence level for full transparency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {assertions.map((assertion, idx) => (
              <AccordionItem key={assertion.id} value={assertion.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left w-full pr-4">
                    {/* Status icon */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{statusIcon(assertion.reconciliation_status)}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="capitalize">
                            {assertion.reconciliation_status}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Content preview */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {assertion.assertion_content ||
                          (assertion.asserted_property
                            ? `${assertion.asserted_property}: ${assertion.asserted_value}`
                            : `Claim #${idx + 1}`)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {assertion.contributed_by || "Unknown contributor"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {formatDate(assertion.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Confidence badge */}
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize flex-shrink-0 ${confidenceColor(assertion.confidence)}`}
                    >
                      {assertion.confidence}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pl-7 pt-2">
                    {/* Full assertion content */}
                    {assertion.assertion_content && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Claim
                        </p>
                        <p className="text-sm">{assertion.assertion_content}</p>
                      </div>
                    )}

                    {/* Asserted property / value */}
                    {assertion.asserted_property && (
                      <div className="flex gap-8">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Property
                          </p>
                          <p className="text-sm capitalize">
                            {assertion.asserted_property.replace(/_/g, " ")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Value
                          </p>
                          <p className="text-sm">{assertion.asserted_value}</p>
                        </div>
                      </div>
                    )}

                    {/* Source */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Source
                      </p>
                      {assertion.source ? (
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">
                              {assertion.source.name}
                            </p>
                            <Badge
                              variant="outline"
                              className="text-xs capitalize mt-0.5"
                            >
                              {assertion.source.source_type.replace(/_/g, " ")}
                            </Badge>
                            {assertion.source.citation && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {assertion.source.citation}
                              </p>
                            )}
                            {assertion.source.url && (
                              <a
                                href={assertion.source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View source
                              </a>
                            )}
                          </div>
                        </div>
                      ) : assertion.source_citation ? (
                        <p className="text-sm text-muted-foreground">
                          {assertion.source_citation}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No source cited
                        </p>
                      )}
                    </div>

                    {/* Data quality note */}
                    {assertion.data_quality_note && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Quality Notes
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {assertion.data_quality_note}
                        </p>
                      </div>
                    )}

                    {/* Metadata row */}
                    <Separator />
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {assertion.contributed_by || "Unknown"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(assertion.created_at)}
                      </span>
                      <span className="capitalize flex items-center gap-1">
                        {statusIcon(assertion.reconciliation_status)}
                        {assertion.reconciliation_status}
                      </span>
                      {assertion.supersedes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Supersedes previous claim
                        </span>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
