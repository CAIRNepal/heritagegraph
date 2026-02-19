"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Calendar,
  User,
  Tag,
  Edit,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { toast, Toaster } from "sonner";

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
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

import { getOntologyClass } from "@/lib/ontology";
import type { OntologyClass, OntologyField } from "@/lib/ontology";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function formatFieldValue(value: unknown, field?: OntologyField): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

// ---------------------------------------------------------------------------
// VIEW PAGE
// ---------------------------------------------------------------------------
export default function OntologyViewPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const domain = params.domain as string;
  const id = params.id as string;

  const ontologyClass = getOntologyClass(domain);

  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecord = useCallback(async () => {
    if (!ontologyClass) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = (session as any)?.accessToken;
      const url = `${API_BASE_URL}${ontologyClass.apiEndpoint}${id}/`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? `${ontologyClass.label} not found.`
            : `Failed to load (HTTP ${res.status})`
        );
      }
      const data = await res.json();
      setRecord(data);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message || "Something went wrong");
      toast.error(err.message || "Failed to load record");
    } finally {
      setIsLoading(false);
    }
  }, [ontologyClass, id, session]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  // --- Unknown domain ---
  if (!ontologyClass) {
    return (
      <div className="px-4 lg:px-6 py-12 text-center space-y-4">
        <h2 className="text-2xl font-bold">Unknown domain</h2>
        <p className="text-muted-foreground">
          The domain &ldquo;{domain}&rdquo; is not recognized.
        </p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  // --- Loading ---
  if (isLoading) {
    return (
      <div className="px-4 lg:px-6 py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground mt-4">
          Loading {ontologyClass.label.toLowerCase()}…
        </p>
      </div>
    );
  }

  // --- Error ---
  if (error || !record) {
    return (
      <div className="px-4 lg:px-6 py-12 text-center space-y-4">
        <h2 className="text-2xl font-bold">Error</h2>
        <p className="text-muted-foreground">{error || "Record not found."}</p>
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/dashboard/knowledge/${ontologyClass.key}`)
          }
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to{" "}
          {ontologyClass.labelPlural}
        </Button>
      </div>
    );
  }

  // --- Group fields by section ---
  const sections = ontologyClass.sections || [
    { key: "basic", label: "Details" },
  ];
  const fieldsBySection: Record<string, OntologyField[]> = {};
  for (const section of sections) {
    fieldsBySection[section.key] = ontologyClass.fields
      .filter((f) => (f.section || "basic") === section.key)
      .sort((a, b) => (a.order || 99) - (b.order || 99));
  }

  // Determine display name
  const displayName =
    (record.name as string) ||
    (record.title as string) ||
    `${ontologyClass.label} #${id}`;

  // Status & metadata
  const status = record.status as string | undefined;
  const category = record.category as string | undefined;
  const contributor = record.contributor as
    | { username?: string; first_name?: string; last_name?: string; email?: string }
    | undefined;
  const createdAt = record.created_at as string | undefined;
  const updatedAt = record.updated_at as string | undefined;

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="px-4 lg:px-6 space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() =>
            router.push(`/dashboard/knowledge/${ontologyClass.key}`)
          }
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {ontologyClass.labelPlural}
        </Button>

        {/* Header card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-3 flex-1">
                <CardTitle className="text-2xl md:text-3xl">
                  {displayName}
                </CardTitle>

                <div className="flex flex-wrap gap-2">
                  {status && (
                    <Badge
                      variant={
                        status === "accepted"
                          ? "default"
                          : status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {status.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {category && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {category}
                    </Badge>
                  )}
                  <Badge variant="outline" className="flex items-center gap-1">
                    {ontologyClass.label}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {contributor && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>
                        {[contributor.first_name, contributor.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                          contributor.username ||
                          "Unknown"}
                      </span>
                    </div>
                  )}
                  {createdAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Created {formatDate(createdAt)}</span>
                    </div>
                  )}
                  {updatedAt && updatedAt !== createdAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Updated {formatDate(updatedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/dashboard/contribute/${ontologyClass.key}`)
                }
              >
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Detail sections */}
        {sections.map((section) => {
          const fields = fieldsBySection[section.key] || [];
          // Only render sections that have at least one non-empty value
          const fieldsWithValues = fields.filter((f) => {
            const val = record[f.key];
            return val !== null && val !== undefined && val !== "";
          });
          if (fieldsWithValues.length === 0) return null;

          return (
            <Card key={section.key}>
              <CardHeader>
                <CardTitle className="text-lg">{section.label}</CardTitle>
                {section.description && (
                  <CardDescription>{section.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {fieldsWithValues.map((field) => {
                      const value = record[field.key];
                      const formatted = formatFieldValue(value, field);

                      return (
                        <TableRow key={field.key}>
                          <TableCell className="font-medium w-1/3 text-muted-foreground">
                            {field.label}
                          </TableCell>
                          <TableCell>
                            {field.type === "url" && typeof value === "string" ? (
                              <a
                                href={value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1"
                              >
                                {value}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : field.type === "coordinates" &&
                              typeof value === "string" ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {value}
                              </span>
                            ) : field.type === "select" && field.options ? (
                              <Badge variant="outline">
                                {field.options.find(
                                  (o) => o.value === String(value)
                                )?.label || formatted}
                              </Badge>
                            ) : (
                              <span className="whitespace-pre-wrap">
                                {formatted}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}

        {/* Show any extra fields from API not in the schema */}
        {(() => {
          const knownKeys = new Set([
            ...ontologyClass.fields.map((f) => f.key),
            "id",
            "status",
            "category",
            "contributor",
            "created_at",
            "updated_at",
          ]);
          const extraEntries = Object.entries(record).filter(
            ([k, v]) =>
              !knownKeys.has(k) &&
              v !== null &&
              v !== undefined &&
              v !== "" &&
              !k.startsWith("_")
          );
          if (extraEntries.length === 0) return null;

          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Information</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {extraEntries.map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium w-1/3 text-muted-foreground capitalize">
                          {key.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-pre-wrap">
                            {formatFieldValue(value)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </>
  );
}
