"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, Calendar, User, Tag, Edit, ExternalLink, MapPin, ThumbsUp, ThumbsDown, GitFork, Share2, MessageSquare, ChevronDown } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getOntologyClass } from "@/lib/ontology";
import type { OntologyClass, OntologyField } from "@/lib/ontology";
import { motion } from "framer-motion";
import { IconSparkles } from "@tabler/icons-react";
import { ReactionButtons } from "@/components/reaction-buttons";
import { ShareButton } from "@/components/share-button";
import { ForkButton, ForkList } from "@/components/fork-button";
import { EntityComments } from "@/components/entity-comments";
import { Separator } from "@/components/ui/separator";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const fadeInUp = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } } };

function formatDate(dateString: string) {
  try { return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); } catch { return dateString; }
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
  const [activeTab, setActiveTab] = useState("details");

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
        <h2 className="text-2xl font-bold">Unknown domain</h2>
        <p className="text-muted-foreground">The domain &ldquo;{domain}&rdquo; is not recognized.</p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}><ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
        <p className="text-muted-foreground mt-4">Loading {ontologyClass.label.toLowerCase()}…</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="py-12 text-center space-y-4">
        <h2 className="text-2xl font-bold">Error</h2>
        <p className="text-muted-foreground">{error || "Record not found."}</p>
        <Button variant="outline" onClick={() => router.push(`/dashboard/knowledge/${ontologyClass.key}`)}><ArrowLeft className="h-4 w-4 mr-2" /> Back to {ontologyClass.labelPlural}</Button>
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
  
  // For reactions, comments, forks — use cultural_entity_id if available (from CIDOC mixin)
  // Otherwise, the record might be a direct CulturalEntity or legacy CIDOC without wrapper
  const culturalEntityId = (record.cultural_entity_id as string) || (record.entity_id as string) || null;
  const hasEntityFeatures = !!culturalEntityId;

  return (
    <>
      <Toaster position="top-right" richColors />
      
      {/* Sticky Action Bar - Always visible */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b py-3 px-4 -mx-4 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/knowledge/${ontologyClass.key}`)} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="shrink-0 text-xs">{ontologyClass.label}</Badge>
                {status && <Badge variant={status === 'accepted' ? 'default' : status === 'rejected' ? 'destructive' : 'outline'} className="shrink-0 text-xs">{status.replace(/_/g, " ")}</Badge>}
              </div>
              <h1 className="font-semibold truncate text-sm mt-0.5">{displayName}</h1>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {hasEntityFeatures ? (
              <>
                <ReactionButtons entityId={culturalEntityId!} size="sm" />
                <Separator orientation="vertical" className="h-6" />
                <ForkButton entityId={culturalEntityId!} entityName={displayName} size="sm" variant="ghost" />
                <ShareButton entityId={culturalEntityId!} entityName={displayName} size="sm" variant="ghost" />
                <Separator orientation="vertical" className="h-6" />
              </>
            ) : (
              <ShareButton entityId={id} entityName={displayName} size="sm" variant="ghost" />
            )}
            <Button size="sm" onClick={() => router.push(`/dashboard/contribute/${ontologyClass.key}`)}>
              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2/3 width on desktop */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Card */}
          <motion.div initial="hidden" animate="show" variants={fadeInUp} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-6 text-primary-foreground">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">
                    <IconSparkles className="w-3.5 h-3.5" /> {ontologyClass.label}
                  </div>
                  <h1 className="text-2xl font-bold">{displayName}</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm opacity-90">
                {contributor && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {[contributor.first_name, contributor.last_name].filter(Boolean).join(" ") || contributor.username || "Unknown"}
                  </span>
                )}
                {category && (
                  <span className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    {category}
                  </span>
                )}
                {createdAt && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(createdAt)}
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Tabbed Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start bg-muted/50 p-1">
              <TabsTrigger value="details" className="flex-1 sm:flex-none">Details</TabsTrigger>
              <TabsTrigger value="discussion" className="flex-1 sm:flex-none">
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Discussion
              </TabsTrigger>
              <TabsTrigger value="forks" className="flex-1 sm:flex-none">
                <GitFork className="h-3.5 w-3.5 mr-1.5" /> Forks
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="mt-4 space-y-4">
              <motion.div initial="hidden" animate="show" variants={staggerContainer}>
                {sections.map((section) => {
                  const fields = fieldsBySection[section.key] || [];
                  const fieldsWithValues = fields.filter((f) => { const val = record[f.key]; return val !== null && val !== undefined && val !== ""; });
                  if (fieldsWithValues.length === 0) return null;
                  return (
                    <motion.div key={section.key} variants={fadeInUp} className="rounded-lg border bg-card">
                      <div className="p-4 border-b bg-muted/30">
                        <h3 className="font-semibold">{section.label}</h3>
                        {section.description && <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>}
                      </div>
                      <div className="p-4">
                        <Table>
                          <TableBody>
                            {fieldsWithValues.map((field) => {
                              const value = record[field.key];
                              const formatted = formatFieldValue(value, field);
                              return (
                                <TableRow key={field.key} className="border-muted">
                                  <TableCell className="font-medium w-1/3 text-muted-foreground py-2.5">{field.label}</TableCell>
                                  <TableCell className="py-2.5">
                                    {field.type === "url" && typeof value === "string" ? (
                                      <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">{value}<ExternalLink className="h-3 w-3" /></a>
                                    ) : field.type === "coordinates" && typeof value === "string" ? (
                                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{value}</span>
                                    ) : field.type === "select" && field.options ? (
                                      <Badge variant="secondary">{field.options.find((o) => o.value === String(value))?.label || formatted}</Badge>
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
                  const knownKeys = new Set([...ontologyClass.fields.map((f) => f.key), "id", "status", "category", "contributor", "created_at", "updated_at", "cultural_entity_id", "entity_id"]);
                  const extraEntries = Object.entries(record).filter(([k, v]) => !knownKeys.has(k) && v !== null && v !== undefined && v !== "" && !k.startsWith("_"));
                  if (extraEntries.length === 0) return null;
                  return (
                    <motion.div variants={fadeInUp} className="rounded-lg border bg-card">
                      <div className="p-4 border-b bg-muted/30">
                        <h3 className="font-semibold">Additional Information</h3>
                      </div>
                      <div className="p-4">
                        <Table>
                          <TableBody>
                            {extraEntries.map(([key, value]) => (
                              <TableRow key={key} className="border-muted">
                                <TableCell className="font-medium w-1/3 text-muted-foreground capitalize py-2.5">{key.replace(/_/g, " ")}</TableCell>
                                <TableCell className="py-2.5"><span className="whitespace-pre-wrap">{formatFieldValue(value)}</span></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </motion.div>
                  );
                })()}
              </motion.div>
            </TabsContent>
            
            <TabsContent value="discussion" className="mt-4">
              <div className="rounded-lg border bg-card p-4">
                {hasEntityFeatures ? (
                  <EntityComments entityId={culturalEntityId!} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Comments are available for contributions that have been submitted through the contribution workflow.</p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="forks" className="mt-4">
              <div className="rounded-lg border bg-card p-4">
                {hasEntityFeatures ? (
                  <ForkList entityId={culturalEntityId!} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <GitFork className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Forking is available for contributions that have been submitted through the contribution workflow.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - 1/3 width on desktop */}
        <div className="space-y-4">
          {/* Quick Stats Card */}
          <motion.div initial="hidden" animate="show" variants={fadeInUp} className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold mb-3">Engagement</h3>
            {hasEntityFeatures ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4" /> Reactions
                  </span>
                  <ReactionButtons entityId={culturalEntityId!} size="sm" />
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <GitFork className="h-4 w-4" /> Fork this
                  </span>
                  <ForkButton entityId={culturalEntityId!} entityName={displayName} size="sm" variant="outline" />
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Share2 className="h-4 w-4" /> Share
                  </span>
                  <ShareButton entityId={culturalEntityId!} entityName={displayName} size="sm" variant="outline" />
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p className="mb-3">Reactions and forking require the contribution workflow.</p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" /> Share
                  </span>
                  <ShareButton entityId={id} entityName={displayName} size="sm" variant="outline" />
                </div>
              </div>
            )}
          </motion.div>

          {/* Metadata Card */}
          <motion.div initial="hidden" animate="show" variants={fadeInUp} className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold mb-3">Metadata</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Type</dt>
                <dd><Badge variant="secondary">{ontologyClass.label}</Badge></dd>
              </div>
              {status && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd><Badge variant={status === 'accepted' ? 'default' : status === 'rejected' ? 'destructive' : 'outline'}>{status.replace(/_/g, " ")}</Badge></dd>
                </div>
              )}
              {category && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd className="text-right">{category}</dd>
                </div>
              )}
              {createdAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>{formatDate(createdAt)}</dd>
                </div>
              )}
              {updatedAt && updatedAt !== createdAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd>{formatDate(updatedAt)}</dd>
                </div>
              )}
            </dl>
          </motion.div>

          {/* Contributor Card */}
          {contributor && (
            <motion.div initial="hidden" animate="show" variants={fadeInUp} className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold mb-3">Contributor</h3>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {(contributor.first_name?.[0] || contributor.username?.[0] || "?").toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{[contributor.first_name, contributor.last_name].filter(Boolean).join(" ") || contributor.username}</p>
                  {contributor.email && <p className="text-xs text-muted-foreground">{contributor.email}</p>}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}
