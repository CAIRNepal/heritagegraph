"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, Calendar, User, Tag, Edit, ExternalLink, MapPin } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { getOntologyClass } from "@/lib/ontology";
import type { OntologyClass, OntologyField } from "@/lib/ontology";
import { motion } from "framer-motion";
import { IconSparkles } from "@tabler/icons-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const fadeInUp = { hidden: { opacity: 0, y: 60 }, show: { opacity: 1, y: 0, transition: { duration: 0.8 } } };
const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } } };
const glassCard = "bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg";

function formatDate(dateString: string) {
  try { return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return dateString; }
}
function formatFieldValue(value: unknown, field?: OntologyField): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

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
    setIsLoading(true); setError(null);
    try {
      const token = (session as any)?.accessToken;
      const url = `${API_BASE_URL}${ontologyClass.apiEndpoint}${id}/`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(res.status === 404 ? `${ontologyClass.label} not found.` : `Failed to load (HTTP ${res.status})`);
      setRecord(await res.json());
    } catch (err: any) { setError(err.message || "Something went wrong"); toast.error(err.message || "Failed to load record"); }
    finally { setIsLoading(false); }
  }, [ontologyClass, id, session]);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  if (!ontologyClass) {
    return (
      <div className="py-12 text-center space-y-4">
        <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100">Unknown domain</h2>
        <p className="text-blue-700 dark:text-blue-300">The domain &ldquo;{domain}&rdquo; is not recognized.</p>
        <Button variant="outline" onClick={() => router.push("/dashboard")} className="border-blue-200"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
        <p className="text-blue-700 dark:text-blue-300 mt-4">Loading {ontologyClass.label.toLowerCase()}…</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="py-12 text-center space-y-4">
        <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100">Error</h2>
        <p className="text-blue-700 dark:text-blue-300">{error || "Record not found."}</p>
        <Button variant="outline" onClick={() => router.push(`/dashboard/knowledge/${ontologyClass.key}`)} className="border-blue-200"><ArrowLeft className="h-4 w-4 mr-2" /> Back to {ontologyClass.labelPlural}</Button>
      </div>
    );
  }

  const sections = ontologyClass.sections || [{ key: "basic", label: "Details" }];
  const fieldsBySection: Record<string, OntologyField[]> = {};
  for (const section of sections) {
    fieldsBySection[section.key] = ontologyClass.fields.filter((f) => (f.section || "basic") === section.key).sort((a, b) => (a.order || 99) - (b.order || 99));
  }

  const displayName = (record.name as string) || (record.title as string) || `${ontologyClass.label} #${id}`;
  const status = record.status as string | undefined;
  const category = record.category as string | undefined;
  const contributor = record.contributor as { username?: string; first_name?: string; last_name?: string; email?: string } | undefined;
  const createdAt = record.created_at as string | undefined;
  const updatedAt = record.updated_at as string | undefined;

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="space-y-6">
        {/* Hero Header */}
        <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8`}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <motion.div variants={fadeInUp} className="relative z-10">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/knowledge/${ontologyClass.key}`)} className="text-white hover:bg-white/20 mb-3">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to {ontologyClass.labelPlural}
            </Button>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-3 flex-1">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
                  <IconSparkles className="w-4 h-4" /> {ontologyClass.label}
                </div>
                <h1 className="text-3xl font-black text-white">{displayName}</h1>
                <div className="flex flex-wrap gap-2">
                  {status && <Badge className={`${status === 'accepted' ? 'bg-green-500/50' : status === 'rejected' ? 'bg-red-500/50' : 'bg-white/20'} text-white border-white/30`}>{status.replace(/_/g, " ")}</Badge>}
                  {category && <Badge className="bg-white/20 text-white border-white/30"><Tag className="h-3 w-3 mr-1" />{category}</Badge>}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-blue-100">
                  {contributor && <span className="flex items-center gap-1"><User className="h-4 w-4" />{[contributor.first_name, contributor.last_name].filter(Boolean).join(" ") || contributor.username || "Unknown"}</span>}
                  {createdAt && <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />Created {formatDate(createdAt)}</span>}
                  {updatedAt && updatedAt !== createdAt && <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />Updated {formatDate(updatedAt)}</span>}
                </div>
              </div>
              <Button onClick={() => router.push(`/dashboard/contribute/${ontologyClass.key}`)} className="bg-white/20 border border-white/30 text-white hover:bg-white/30">
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
            </div>
          </motion.div>
        </motion.div>

        {/* Detail sections */}
        <motion.div initial="hidden" animate="show" variants={staggerContainer} className="space-y-4">
          {sections.map((section) => {
            const fields = fieldsBySection[section.key] || [];
            const fieldsWithValues = fields.filter((f) => { const val = record[f.key]; return val !== null && val !== undefined && val !== ""; });
            if (fieldsWithValues.length === 0) return null;
            return (
              <motion.div key={section.key} variants={fadeInUp} className={glassCard}>
                <div className="p-5 border-b border-blue-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">{section.label}</h3>
                  {section.description && <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{section.description}</p>}
                </div>
                <div className="p-5">
                  <Table>
                    <TableBody>
                      {fieldsWithValues.map((field) => {
                        const value = record[field.key];
                        const formatted = formatFieldValue(value, field);
                        return (
                          <TableRow key={field.key} className="border-blue-100 dark:border-gray-700/50">
                            <TableCell className="font-medium w-1/3 text-blue-600 dark:text-blue-400">{field.label}</TableCell>
                            <TableCell className="text-blue-900 dark:text-blue-100">
                              {field.type === "url" && typeof value === "string" ? (
                                <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">{value}<ExternalLink className="h-3 w-3" /></a>
                              ) : field.type === "coordinates" && typeof value === "string" ? (
                                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-blue-500" />{value}</span>
                              ) : field.type === "select" && field.options ? (
                                <Badge variant="outline" className="border-blue-200 dark:border-gray-600">{field.options.find((o) => o.value === String(value))?.label || formatted}</Badge>
                              ) : <span className="whitespace-pre-wrap">{formatted}</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            );
          })}

          {/* Extra fields */}
          {(() => {
            const knownKeys = new Set([...ontologyClass.fields.map((f) => f.key), "id", "status", "category", "contributor", "created_at", "updated_at"]);
            const extraEntries = Object.entries(record).filter(([k, v]) => !knownKeys.has(k) && v !== null && v !== undefined && v !== "" && !k.startsWith("_"));
            if (extraEntries.length === 0) return null;
            return (
              <motion.div variants={fadeInUp} className={glassCard}>
                <div className="p-5 border-b border-blue-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">Additional Information</h3>
                </div>
                <div className="p-5">
                  <Table>
                    <TableBody>
                      {extraEntries.map(([key, value]) => (
                        <TableRow key={key} className="border-blue-100 dark:border-gray-700/50">
                          <TableCell className="font-medium w-1/3 text-blue-600 dark:text-blue-400 capitalize">{key.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-blue-900 dark:text-blue-100"><span className="whitespace-pre-wrap">{formatFieldValue(value)}</span></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            );
          })()}
        </motion.div>
      </div>
    </>
  );
}
