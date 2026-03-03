"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, Calendar, User, Tag, Edit, ExternalLink, MapPin } from "lucide-react";
import { toast } from "sonner";
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
const fadeInUp = { initial: { opacity: 1, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const staggerContainer = { initial: { opacity: 1 }, animate: { opacity: 1, transition: { staggerChildren: 0.05 } } };

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

export default function EntityViewPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const domain = "entity"; // Fixed domain for this route
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
  const entityId = (record.entity_id as string) || id;

  return (
    <motion.div initial="initial" animate="animate" variants={staggerContainer} className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div variants={fadeInUp} className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/knowledge/${ontologyClass.key}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to {ontologyClass.labelPlural}
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-100">{displayName}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {status && <Badge variant="secondary" className="capitalize">{status.replace(/_/g, " ")}</Badge>}
              <Badge variant="outline" className="gap-1"><Tag className="h-3 w-3" /> {ontologyClass.label}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ReactionButtons entityType="cultural_entity" entityId={entityId} />
            <ShareButton entityType="entity" entityId={entityId} entityName={displayName} />
            <ForkButton entityType="cultural_entity" entityId={entityId} />
          </div>
        </div>
      </motion.div>

      {/* Content Tabs */}
      <motion.div variants={fadeInUp}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="forks">Forks</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {sections.map((section) => (
              <div key={section.key} className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-xl p-4">
                <h3 className="font-semibold text-lg mb-3 text-blue-900 dark:text-blue-100">{section.label}</h3>
                <Table>
                  <TableBody>
                    {(fieldsBySection[section.key] || []).map((field) => (
                      <TableRow key={field.key}>
                        <TableCell className="font-medium w-1/3">{field.label}</TableCell>
                        <TableCell>{formatFieldValue(record[field.key], field)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="comments">
            <EntityComments entityType="cultural_entity" entityId={entityId} />
          </TabsContent>

          <TabsContent value="forks">
            <ForkList entityType="cultural_entity" entityId={entityId} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
