"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ValidationStatusPanel } from "@/components/projects/ValidationStatusPanel";
import { useProjectDetail } from "@/hooks/use-project-detail";
import { fadeInUp } from "@/lib/design";

interface DiffPreview {
  added_count: number;
  removed_count: number;
  conflict_count: number;
}

export default function OpenMergeRequestPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { project, loading: projectLoading } = useProjectDetail(params.slug);

  const [validationPassed, setValidationPassed] = useState(false);
  const [summary, setSummary] = useState("");
  const [justification, setJustification] = useState("");
  const [scope, setScope] = useState<"whole" | "subset">("whole");
  const [diff, setDiff] = useState<DiffPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleValidationPass = useCallback(() => {
    setValidationPassed(true);
    // Fetch diff preview when validation passes
    if (!session?.accessToken || !project) return;
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/merge-requests/validate/?project_id=${project.id}&include_diff=true`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    )
      .then((r) => r.json())
      .then((d) => setDiff(d.diff ?? null))
      .catch(() => {});
  }, [session, project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !project) return;
    if (!summary.trim()) {
      toast.error("Summary is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/merge-requests/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project: project.id,
          summary,
          justification,
          scope,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.shacl_violations) {
          toast.error("SHACL validation failed — fix errors before opening.");
        } else {
          toast.error(data?.detail ?? "Failed to open merge request.");
        }
        return;
      }

      toast.success("Merge request opened successfully.");
      router.push(`/review/${data.id}`);
    } catch (err) {
      toast.error("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (projectLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Project not found.</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <motion.div {...fadeInUp}>
        <p className="text-xs text-muted-foreground">Project: {project.title}</p>
        <h1 className="text-2xl font-bold">Open Merge Request</h1>
      </motion.div>

      {/* Pre-flight validation */}
      <motion.div {...fadeInUp} transition={{ delay: 0.05 }}>
        <ValidationStatusPanel
          projectSlug={params.slug}
          projectId={String(project.id)}
          onValidationPass={handleValidationPass}
        />
      </motion.div>

      {/* Conflict diff preview (shown after validation passes) */}
      {diff && (
        <motion.div
          {...fadeInUp}
          transition={{ delay: 0.08 }}
          className="rounded-lg border bg-card p-4 space-y-2"
        >
          <h3 className="text-sm font-semibold">Conflict diff preview</h3>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-green-600 border-green-300">
                + {diff.added_count} triple{diff.added_count !== 1 ? "s" : ""} to add
              </Badge>
              {diff.conflict_count > 0 ? (
                <Badge variant="secondary" className="text-amber-600 border-amber-300">
                  ~ {diff.conflict_count} conflict{diff.conflict_count !== 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-muted-foreground">
                  ~ 0 conflicts
                </Badge>
              )}
              <Badge variant="secondary" className="text-muted-foreground">
                - {diff.removed_count} removed
              </Badge>
            </div>
          </div>
        </motion.div>
      )}

      {/* Form */}
      <motion.form
        {...fadeInUp}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="rounded-lg border bg-card p-4 space-y-5"
      >
        {/* Scope */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Scope</Label>
          <RadioGroup
            value={scope}
            onValueChange={(v) => setScope(v as "whole" | "subset")}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="whole" id="scope-whole" />
              <Label htmlFor="scope-whole" className="text-sm cursor-pointer">
                Whole project graph
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="subset" id="scope-subset" />
              <Label htmlFor="scope-subset" className="text-sm cursor-pointer">
                Select subset of entities
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Summary */}
        <div className="space-y-1.5">
          <Label htmlFor="mr-summary" className="text-sm font-medium">
            Summary <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="mr-summary"
            rows={3}
            placeholder="Documents Bhairabnath Temple with 3 CIDOC entities and 11 HeritageAssertions sourced from Slusser 1982 field survey."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
          />
        </div>

        {/* Justification (only required if conflicts) */}
        <div className="space-y-1.5">
          <Label htmlFor="mr-justification" className="text-sm font-medium">
            Justification for any conflicts
            {!diff?.conflict_count && (
              <span className="ml-1 text-xs text-muted-foreground">(none required)</span>
            )}
          </Label>
          <Textarea
            id="mr-justification"
            rows={2}
            placeholder="Explain why conflicting triples should override existing values…"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!validationPassed || submitting || !summary.trim()}
          >
            {submitting ? "Opening…" : "Open Merge Request →"}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
