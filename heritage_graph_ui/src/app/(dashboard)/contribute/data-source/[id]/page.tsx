"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconArrowLeft,
  IconCopy,
  IconExternalLink,
  IconDatabase,
  IconFile,
  IconAlertTriangle,
  IconClock,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { fadeInUp, glassCard, staggerContainer } from "@/lib/design";
import {
  getDataSource,
  ingestStatusColor,
  type DataSourceDetail,
} from "@/lib/data-source-api";

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2 border-b border-border last:border-0">
      <span className="w-40 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm break-all">{value}</span>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className="p-1 rounded hover:bg-muted transition-colors"
      title="Copy"
    >
      {copied ? (
        <IconCheck className="size-4 text-green-600" />
      ) : (
        <IconCopy className="size-4 text-muted-foreground" />
      )}
    </button>
  );
}

function IngestStatusBadge({ status, display }: { status: string; display: string }) {
  const icons: Record<string, React.ReactNode> = {
    pending: <IconClock className="size-3" />,
    processing: <IconLoader2 className="size-3 animate-spin" />,
    ready: <IconCheck className="size-3" />,
    failed: <IconAlertTriangle className="size-3" />,
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        ingestStatusColor(status as never)
      )}
    >
      {icons[status]}
      {display}
    </span>
  );
}

function IIIFViewerPlaceholder({ manifest }: { manifest: Record<string, unknown> | null }) {
  if (!manifest) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-12 text-center">
        <IconFile className="size-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">IIIF viewer</p>
        <p className="text-xs text-muted-foreground mt-1">
          Manifest is still being generated. Check back once ingest status is{" "}
          <span className="font-medium">Ready</span>.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
        <span className="text-xs font-medium">IIIF Presentation v3 — Viewer placeholder</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          IIIF
        </Badge>
      </div>
      <div className="flex flex-col items-center justify-center p-12 text-center bg-background">
        <IconFile className="size-10 text-brand-blue mb-3" />
        <p className="text-sm font-medium">Manifest ready</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Integrate a Mirador or Universal Viewer component here. The manifest
          JSON is stored in the API response under <code>iiif_manifest</code>.
        </p>
        <a
          href={`${String(manifest.id ?? "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-xs text-brand-blue underline underline-offset-2"
        >
          View manifest <IconExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

export default function DataSourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const [source, setSource] = useState<DataSourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken || !id) return;
    setLoading(true);
    getDataSource(session.accessToken, id)
      .then(setSource)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session, id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !source) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <IconAlertTriangle className="mx-auto size-10 text-destructive mb-4" />
        <p className="text-lg font-semibold">Could not load data source</p>
        <p className="text-sm text-muted-foreground mt-1">{error ?? "Source not found."}</p>
        <Button className="mt-6" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* ── Back + header ── */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          className="mb-6"
        >
          <button
            onClick={() => router.back()}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconArrowLeft className="size-4" />
            Back
          </button>
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-brand-blue/10 shrink-0">
              <IconDatabase className="size-6 text-brand-blue" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">{source.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">
                  {source.source_type.replace("_", " ")}
                </Badge>
                <IngestStatusBadge
                  status={source.ingest_status}
                  display={source.ingest_status_display}
                />
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs",
                    source.access_tier === "sensitive_indigenous" &&
                      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                  )}
                >
                  {source.access_tier_display}
                </Badge>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* ── IIIF viewer ── */}
          {(source.source_type === "image" ||
            source.source_type === "archival") && (
            <motion.section variants={fadeInUp}>
              <IIIFViewerPlaceholder manifest={source.iiif_manifest} />
            </motion.section>
          )}

          {/* ── PID / RDF metadata ── */}
          {source.pid && (
            <motion.section variants={fadeInUp} className={cn(glassCard, "p-5")}>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Persistent Identifier
              </h2>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs break-all bg-muted rounded px-2 py-1.5">
                  {source.pid}
                </code>
                <CopyButton value={source.pid} />
                <a
                  href={source.pid}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title="Open PID"
                >
                  <IconExternalLink className="size-4 text-muted-foreground" />
                </a>
              </div>
            </motion.section>
          )}

          {/* ── Metadata panel ── */}
          <motion.section variants={fadeInUp} className={cn(glassCard, "p-6")}>
            <h2 className="text-base font-semibold mb-4">Metadata</h2>
            <div className="divide-y divide-border">
              <MetaRow label="Author" value={source.author} />
              <MetaRow label="Citation" value={source.citation} />
              <MetaRow label="URL" value={source.url} />
              <MetaRow label="Note" value={source.note} />
              <MetaRow label="Created" value={new Date(source.created_at).toLocaleString()} />
              <MetaRow label="Updated" value={new Date(source.updated_at).toLocaleString()} />
              <MetaRow label="HG class" value={source.hg_class} />
            </div>
          </motion.section>

          {/* ── DataCite metadata ── */}
          {(source.datacite_identifier ||
            source.datacite_creator ||
            source.datacite_publisher) && (
            <motion.section variants={fadeInUp} className={cn(glassCard, "p-6")}>
              <h2 className="text-base font-semibold mb-4">DataCite metadata</h2>
              <div className="divide-y divide-border">
                <MetaRow label="Identifier / DOI" value={source.datacite_identifier} />
                <MetaRow label="Creator" value={source.datacite_creator} />
                <MetaRow label="Publisher" value={source.datacite_publisher} />
                <MetaRow
                  label="Year"
                  value={source.datacite_publication_year?.toString()}
                />
                <MetaRow label="Resource type" value={source.datacite_resource_type} />
              </div>
            </motion.section>
          )}

          {/* ── CARE / TK Labels ── */}
          {source.care_labels && source.care_labels.length > 0 && (
            <motion.section variants={fadeInUp} className={cn(glassCard, "p-6")}>
              <h2 className="text-base font-semibold mb-3">CARE / TK Labels</h2>
              <div className="flex flex-wrap gap-2">
                {source.care_labels.map((uri) => (
                  <a
                    key={uri}
                    href={uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:underline dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                  >
                    {uri.split("/").at(-2)?.replace(/-/g, " ")}
                    <IconExternalLink className="size-3" />
                  </a>
                ))}
              </div>
            </motion.section>
          )}
        </motion.div>
      </div>
    </div>
  );
}
