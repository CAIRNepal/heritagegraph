"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, Edit, GitFork, MessageSquare, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getOntologyClass } from "@/lib/ontology";
import type { OntologyField } from "@/lib/ontology";
import { ReactionButtons } from "@/components/reaction-buttons";
import { ShareButton } from "@/components/share-button";
import { ForkButton } from "@/components/fork-button";
import { ForkTreeView } from "@/components/fork-tree-view";
import { EntityComments } from "@/components/entity-comments";
import { EntityQRCode } from "@/components/entity-qr-code";
import { RelatedEntities } from "@/components/knowledge/related-entities";
import { EntityViewHeader } from "@/components/knowledge/entity-view-header";
import { EntityMetadataGrid } from "@/components/knowledge/entity-metadata-grid";
import { EntityProvenanceCard } from "@/components/knowledge/entity-provenance-card";
import { Separator } from "@/components/ui/separator";
import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import {
  authorNamesFromRecord,
  buildEntitySubtitleParts,
  contributorFromRecord,
} from "@/lib/knowledge/entity-view-utils";
import { motion } from "framer-motion";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

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
    setIsLoading(true);
    setError(null);
    try {
      const token = (session as { accessToken?: string } | null)?.accessToken;
      const url = `${API_BASE_URL}${ontologyClass.apiEndpoint}${id}/`;
      const data = await apiFetchJson<Record<string, unknown>>(url, {
        headers: token
          ? { Authorization: `Bearer ${token}`, Accept: "application/json" }
          : { Accept: "application/json" },
      });
      setRecord(data);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(
        err,
        `Could not load this ${ontologyClass.label.toLowerCase()}.`,
      );
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [ontologyClass, id, session]);

  useEffect(() => {
    void fetchRecord();
  }, [fetchRecord]);

  if (!ontologyClass) {
    return (
      <div className="space-y-4 py-12 text-center">
        <h2 className="text-2xl font-bold">Unknown domain</h2>
        <p className="text-muted-foreground">
          The domain &ldquo;{domain}&rdquo; is not recognized.
        </p>
        <Button variant="outline" onClick={() => router.push("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
        <p className="mt-4 text-muted-foreground">
          Loading {ontologyClass.label.toLowerCase()}…
        </p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="space-y-4 py-12 text-center">
        <h2 className="text-2xl font-bold">Error</h2>
        <p className="text-muted-foreground">{error || "Record not found."}</p>
        <Button
          variant="outline"
          onClick={() => router.push(`/knowledge/${ontologyClass.key}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to {ontologyClass.labelPlural}
        </Button>
      </div>
    );
  }

  const sections = ontologyClass.sections || [{ key: "basic", label: "Details" }];
  const fieldsBySection: Record<string, OntologyField[]> = {};
  for (const section of sections) {
    fieldsBySection[section.key] = ontologyClass.fields
      .filter((f) => (f.section || "basic") === section.key)
      .sort((a, b) => (a.order || 99) - (b.order || 99));
  }

  const displayName =
    (record.name as string) || (record.title as string) || `${ontologyClass.label} #${id}`;
  const showRelatedTab = ontologyClass.apiEndpoint.startsWith("/cidoc/");
  const status = record.status as string | undefined;
  const category = record.category as string | undefined;
  const contributorInfo = contributorFromRecord(record);
  const authorNames = authorNamesFromRecord(record);
  const createdAt = record.created_at as string | undefined;
  const updatedAt = record.updated_at as string | undefined;

  const culturalEntityId =
    (record.cultural_entity_id as string) || (record.entity_id as string) || null;
  const hasEntityFeatures = !!culturalEntityId;

  const subtitleParts = buildEntitySubtitleParts(
    record,
    ontologyClass,
    authorNames,
    category,
  );

  const headerActions = (
    <>
      {hasEntityFeatures ? (
        <>
          <ReactionButtons entityId={culturalEntityId!} size="sm" />
          <Separator orientation="vertical" className="h-6" />
          <ForkButton
            entityId={culturalEntityId!}
            entityName={displayName}
            size="sm"
            variant="ghost"
          />
          <ShareButton
            entityId={culturalEntityId!}
            entityName={displayName}
            size="sm"
            variant="ghost"
          />
          <EntityQRCode entityId={culturalEntityId!} entityName={displayName} size="sm" />
          <Separator orientation="vertical" className="h-6" />
        </>
      ) : (
        <>
          <ShareButton entityId={id} entityName={displayName} size="sm" variant="ghost" />
          <EntityQRCode entityId={id} entityName={displayName} size="sm" />
        </>
      )}
      <Button size="sm" onClick={() => router.push(`/contribute/${ontologyClass.key}`)}>
        <Edit className="mr-1 h-3.5 w-3.5" /> Edit
      </Button>
    </>
  );

  return (
    <>
      <EntityViewHeader
        displayName={displayName}
        entityTypeLabel={ontologyClass.label}
        status={status}
        subtitleParts={subtitleParts}
        onBack={() => router.push(`/knowledge/${ontologyClass.key}`)}
        backAriaLabel={`Back to ${ontologyClass.labelPlural}`}
        actions={headerActions}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/40 p-1.5 sm:flex-nowrap">
              <TabsTrigger
                value="details"
                className="flex-1 rounded-lg px-3 py-2 text-sm sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
              >
                Details
              </TabsTrigger>
              <TabsTrigger
                value="discussion"
                className="flex-1 gap-1.5 rounded-lg px-3 py-2 text-sm sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Discussion
              </TabsTrigger>
              <TabsTrigger
                value="forks"
                className="flex-1 gap-1.5 rounded-lg px-3 py-2 text-sm sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
              >
                <GitFork className="h-3.5 w-3.5" />
                Forks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-5 focus-visible:outline-none">
              <EntityMetadataGrid
                ontologyClass={ontologyClass}
                record={record}
                sections={sections}
                fieldsBySection={fieldsBySection}
              />
            </TabsContent>

            <TabsContent value="discussion" className="mt-4">
              <div className="rounded-lg border bg-card p-4">
                {hasEntityFeatures ? (
                  <EntityComments entityId={culturalEntityId!} />
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>
                      Comments are available for contributions that have been submitted through the
                      contribution workflow.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="forks" className="mt-4">
              <div className="rounded-lg border bg-card p-4">
                {hasEntityFeatures ? (
                  <ForkTreeView entityId={culturalEntityId!} />
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <GitFork className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>
                      Forking is available for contributions that have been submitted through the
                      contribution workflow.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          {showRelatedTab ? (
            <motion.div
              initial="hidden"
              animate="show"
              variants={fadeInUp}
              className="flex max-h-[min(70vh,32rem)] flex-col overflow-hidden rounded-lg border bg-card"
            >
              <div className="shrink-0 border-b bg-muted/30 px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  Related in graph
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Records that reference this entity via relation fields.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <RelatedEntities
                  domain={domain}
                  entityId={id}
                  embedded
                  emptyCtaHref={`/contribute/${ontologyClass.key}`}
                  emptyCtaLabel="Add links via contribute"
                />
              </div>
            </motion.div>
          ) : null}

          <EntityProvenanceCard
            createdAt={createdAt}
            updatedAt={updatedAt}
            contributor={contributorInfo}
          />
        </div>
      </div>
    </>
  );
}
