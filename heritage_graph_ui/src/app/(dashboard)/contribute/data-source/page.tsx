"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconUpload,
  IconFile,
  IconX,
  IconDatabase,
  IconAlertCircle,
  IconCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { fadeInUp, glassCard, staggerContainer } from "@/lib/design";
import {
  ACCESS_TIER_OPTIONS,
  DATACITE_RESOURCE_TYPES,
  KNOWN_TK_LABELS,
  SOURCE_TYPE_OPTIONS,
  createDataSource,
  type AccessTier,
  type SourceType,
} from "@/lib/data-source-api";

const FILE_ACCEPT: Partial<Record<SourceType, string>> = {
  image: "image/*",
  pdf: "application/pdf",
  oral_history: "audio/*,video/*",
  field_survey: ".csv,.xlsx,.ods,.json",
  archival: "image/*,application/pdf",
};

const CURRENT_YEAR = new Date().getFullYear();

export default function DataSourceUploadPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // ── form fields ──
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [citation, setCitation] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("archival");
  const [accessTier, setAccessTier] = useState<AccessTier>("public");
  const [careLabels, setCareLabels] = useState<string[]>([]);
  const [dcIdentifier, setDcIdentifier] = useState("");
  const [dcCreator, setDcCreator] = useState("");
  const [dcPublisher, setDcPublisher] = useState("CAIR-Nepal");
  const [dcYear, setDcYear] = useState<string>(String(CURRENT_YEAR));
  const [dcResourceType, setDcResourceType] = useState("Dataset");

  // ── file ──
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── submission ──
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const acceptedMime = FILE_ACCEPT[sourceType] ?? "*";

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) setFile(dropped);
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const toggleCareLabel = (uri: string) => {
    setCareLabels((prev) =>
      prev.includes(uri) ? prev.filter((u) => u !== uri) : [...prev, uri]
    );
  };

  // Reset care labels when tier changes away from sensitive
  useEffect(() => {
    if (accessTier !== "sensitive_indigenous") {
      setCareLabels([]);
    }
  }, [accessTier]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required.";
    if (
      accessTier === "sensitive_indigenous" &&
      careLabels.length === 0
    ) {
      errs.care_labels =
        "At least one TK Label is required for sensitive indigenous sources.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    if (!validate()) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await createDataSource(
        session.accessToken,
        {
          name: name.trim(),
          source_type: sourceType,
          author: author.trim() || undefined,
          citation: citation.trim() || undefined,
          url: url.trim() || undefined,
          note: note.trim() || undefined,
          access_tier: accessTier,
          care_labels: careLabels.length ? careLabels : undefined,
          datacite_identifier: dcIdentifier.trim() || undefined,
          datacite_creator: dcCreator.trim() || undefined,
          datacite_publisher: dcPublisher.trim() || undefined,
          datacite_publication_year: dcYear ? Number(dcYear) : undefined,
          datacite_resource_type: dcResourceType as never,
        },
        file ?? undefined
      );
      router.push(`/contribute/data-source/${result.id}`);
    } catch (err: unknown) {
      const body = (err as { body?: Record<string, unknown> })?.body;
      if (body) {
        const flatErrors: Record<string, string> = {};
        Object.entries(body).forEach(([k, v]) => {
          flatErrors[k] = Array.isArray(v) ? v.join(" ") : String(v);
        });
        setFieldErrors(flatErrors);
        setError("Please fix the errors below.");
      } else {
        setError(
          err instanceof Error ? err.message : "Upload failed. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-3xl px-4">
        {/* ── Page header ── */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-brand-blue/10">
              <IconDatabase className="size-6 text-brand-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Upload a Data Source</h1>
              <p className="text-sm text-muted-foreground">
                Register archival records, images, field surveys, oral histories,
                and other source material for the knowledge graph.
              </p>
            </div>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} noValidate>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            {/* ── Source basics ── */}
            <motion.section variants={fadeInUp} className={cn(glassCard, "p-6")}>
              <h2 className="text-base font-semibold mb-4">Source basics</h2>
              <div className="space-y-4">
                {/* Source type */}
                <div>
                  <Label htmlFor="source_type">Source type *</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {SOURCE_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSourceType(opt.value)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-medium transition-colors text-left",
                          sourceType === opt.value
                            ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                            : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    className="mt-1"
                    placeholder="e.g. Bhaktapur Durbar Square survey photos 2024"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={!!fieldErrors.name}
                  />
                  {fieldErrors.name && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>
                  )}
                </div>

                {/* Author */}
                <div>
                  <Label htmlFor="author">Author / collector</Label>
                  <Input
                    id="author"
                    className="mt-1"
                    placeholder="CAIR-Nepal Field Team"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </div>

                {/* Citation */}
                <div>
                  <Label htmlFor="citation">Citation</Label>
                  <Textarea
                    id="citation"
                    className="mt-1 min-h-[72px]"
                    placeholder="Formal citation string (e.g. APA, Chicago, …)"
                    value={citation}
                    onChange={(e) => setCitation(e.target.value)}
                  />
                </div>

                {/* URL */}
                <div>
                  <Label htmlFor="url">External URL</Label>
                  <Input
                    id="url"
                    type="url"
                    className="mt-1"
                    placeholder="https://…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="note">Notes</Label>
                  <Textarea
                    id="note"
                    className="mt-1 min-h-[80px]"
                    placeholder="Any additional context about this source…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
            </motion.section>

            {/* ── File upload ── */}
            <motion.section variants={fadeInUp} className={cn(glassCard, "p-6")}>
              <h2 className="text-base font-semibold mb-4">File upload</h2>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors",
                  isDragging
                    ? "border-brand-blue bg-brand-blue/5"
                    : "border-border hover:border-border/60 hover:bg-muted/40"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptedMime}
                  className="sr-only"
                  onChange={handleFileChange}
                />
                {file ? (
                  <div className="flex items-center gap-3">
                    <IconFile className="size-8 text-brand-blue" />
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="ml-auto p-1 rounded-full hover:bg-muted"
                    >
                      <IconX className="size-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <IconUpload className="size-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">
                      Drag &amp; drop a file, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Accepted:{" "}
                      {acceptedMime === "*" ? "any file" : acceptedMime}
                    </p>
                  </>
                )}
              </div>
            </motion.section>

            {/* ── DataCite metadata ── */}
            <motion.section variants={fadeInUp} className={cn(glassCard, "p-6")}>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-base font-semibold">DataCite metadata</h2>
                <span className="text-xs text-muted-foreground">
                  Optional — improves discoverability
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="dc_identifier">Identifier / DOI</Label>
                  <Input
                    id="dc_identifier"
                    className="mt-1"
                    placeholder="10.5281/zenodo.123456"
                    value={dcIdentifier}
                    onChange={(e) => setDcIdentifier(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dc_creator">Creator</Label>
                  <Input
                    id="dc_creator"
                    className="mt-1"
                    placeholder="Name of creator or institution"
                    value={dcCreator}
                    onChange={(e) => setDcCreator(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dc_publisher">Publisher</Label>
                  <Input
                    id="dc_publisher"
                    className="mt-1"
                    value={dcPublisher}
                    onChange={(e) => setDcPublisher(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dc_year">Publication year</Label>
                  <Input
                    id="dc_year"
                    type="number"
                    min={1800}
                    max={CURRENT_YEAR + 1}
                    className="mt-1"
                    value={dcYear}
                    onChange={(e) => setDcYear(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="dc_resource_type">Resource type</Label>
                  <Select value={dcResourceType} onValueChange={setDcResourceType}>
                    <SelectTrigger id="dc_resource_type" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATACITE_RESOURCE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.section>

            {/* ── CARE / TK Labels ── */}
            <motion.section variants={fadeInUp} className={cn(glassCard, "p-6")}>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold">CARE / TK Labels</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Traditional Knowledge labels from{" "}
                <span className="font-medium">Local Contexts</span> help
                communicate community protocols for this source.
              </p>

              {/* Access tier */}
              <div className="mb-4">
                <Label htmlFor="access_tier">Access tier</Label>
                <Select
                  value={accessTier}
                  onValueChange={(v) => setAccessTier(v as AccessTier)}
                >
                  <SelectTrigger id="access_tier" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_TIER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {accessTier === "sensitive_indigenous" && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <IconAlertCircle className="size-4 mt-0.5 shrink-0" />
                    <span>
                      Sensitive indigenous sources are restricted to staff and
                      reviewers. At least one TK Label URI must be selected below.
                    </span>
                  </div>
                )}
              </div>

              {/* TK Label chips */}
              <div>
                <Label>TK Labels (click to toggle)</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {KNOWN_TK_LABELS.map((lbl) => {
                    const active = careLabels.includes(lbl.uri);
                    return (
                      <button
                        key={lbl.uri}
                        type="button"
                        onClick={() => toggleCareLabel(lbl.uri)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          active
                            ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                            : "border-border bg-background text-muted-foreground hover:border-border/70 hover:text-foreground"
                        )}
                      >
                        {active && <IconCheck className="size-3" />}
                        {lbl.label}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.care_labels && (
                  <p className="mt-2 text-xs text-destructive flex items-center gap-1">
                    <IconAlertCircle className="size-3" />
                    {fieldErrors.care_labels}
                  </p>
                )}
                {careLabels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {careLabels.map((uri) => (
                      <Badge
                        key={uri}
                        variant="secondary"
                        className="text-xs gap-1"
                      >
                        {uri.split("/").at(-2)}
                        <button
                          type="button"
                          onClick={() => toggleCareLabel(uri)}
                          className="ml-0.5 rounded-full hover:bg-muted"
                        >
                          <IconX className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </motion.section>

            {/* ── Error banner ── */}
            {error && (
              <motion.div
                variants={fadeInUp}
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              >
                <IconAlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* ── Actions ── */}
            <motion.div
              variants={fadeInUp}
              className="flex items-center justify-end gap-3 pb-8"
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !session}>
                {submitting ? "Uploading…" : "Upload source"}
              </Button>
            </motion.div>
          </motion.div>
        </form>
      </div>
    </div>
  );
}
