"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fadeInUp, glassCard } from "@/lib/design";
import { getApiErrorMessage, isApiError } from "@/lib/api-client";
import { createProject, getProject } from "@/lib/projects-api";

const DRAFT_KEY = "hg-project-draft-v1";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function collectSlugIssues(slug: string): string[] {
  const issues: string[] = [];
  if (!slug.trim()) return ["Slug is required."];
  if (slug.length > 80) issues.push("Max 80 characters.");
  if (!/^[a-z0-9-]+$/.test(slug)) issues.push("Only lowercase letters, digits, and hyphens.");
  if (slug.startsWith("-") || slug.endsWith("-")) {
    issues.push("Cannot start or end with a hyphen.");
  }
  return issues;
}

export default function NewProjectPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const idempotencyKeyRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `proj-${Math.random().toString(36).slice(2)}`
  );
  const [restoredDraft, setRestoredDraft] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [abstract, setAbstract] = useState("");
  const [intendedSubject, setIntendedSubject] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [tagsRaw, setTagsRaw] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) {
        setRestoredDraft(true);
        return;
      }
      const o = JSON.parse(raw) as Record<string, unknown>;
      if (typeof o.title === "string") setTitle(o.title);
      if (typeof o.slug === "string") setSlug(o.slug);
      if (typeof o.abstract === "string") setAbstract(o.abstract);
      if (typeof o.intendedSubject === "string") setIntendedSubject(o.intendedSubject);
      if (typeof o.visibility === "string") setVisibility(o.visibility);
      if (typeof o.tagsRaw === "string") setTagsRaw(o.tagsRaw);
    } catch {
      /* ignore */
    }
    setRestoredDraft(true);
  }, []);

  useEffect(() => {
    if (!restoredDraft || typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          title,
          slug,
          abstract,
          intendedSubject,
          visibility,
          tagsRaw,
        })
      );
    } catch {
      /* ignore quota */
    }
  }, [abstract, intendedSubject, restoredDraft, slug, tagsRaw, title, visibility]);

  const slugIssues = useMemo(() => collectSlugIssues(slug.trim()), [slug]);
  const slugInvalid = slugIssues.length > 0;

  const handleTitleChange = (v: string) => {
    setTitle(v);
    setSlug(slugify(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!token) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (slugInvalid) {
      setError(slugIssues.join(" "));
      return;
    }

    setSubmitting(true);
    setError("");

    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const project = await createProject(
        token,
        {
          title: title.trim(),
          slug: slug.trim(),
          abstract: abstract.trim(),
          intended_subject: intendedSubject.trim(),
          visibility,
          tags,
          languages: [],
        },
        { idempotencyKey: idempotencyKeyRef.current }
      );
      sessionStorage.removeItem(DRAFT_KEY);
      router.push(`/contribute/projects/${project.slug}`);
    } catch (err) {
      if (isApiError(err) && err.status === 400) {
        const body =
          typeof err.body === "object" && err.body !== null
            ? (err.body as Record<string, unknown>)
            : {};
        const slugField = body.slug;
        const slugProblems =
          Array.isArray(slugField) &&
          slugField.some(
            (m) =>
              typeof m === "string" &&
              (m.includes("already") || m.includes("unique") || m.includes("exists"))
          );
        if (slugProblems) {
          try {
            const existing = await getProject(slug.trim(), token);
            sessionStorage.removeItem(DRAFT_KEY);
            router.push(`/contribute/projects/${existing.slug}`);
            return;
          } catch {
            /* fall through */
          }
        }
      }
      setError(getApiErrorMessage(err, "Failed to create project."));
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial="hidden" animate="show" variants={fadeInUp}>
        <h1 className="text-2xl font-bold text-blue-900 dark:text-blue-100">New Project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A project is your working dossier — collect evidence, author entities, then request review.
        </p>
      </motion.div>

      <motion.form
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        onSubmit={handleSubmit}
        className={`${glassCard} p-6 space-y-5`}
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g. Patan Durbar Square — iconographic survey"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            aria-invalid={slugInvalid || undefined}
            aria-describedby="slug-help slug-errors"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="auto-filled from title"
            required
          />
          <p id="slug-help" className="text-xs text-muted-foreground">
            Lowercase letters, digits, and hyphens only (max 80).
          </p>
          {slugInvalid && slug.trim() && (
            <ul id="slug-errors" className="text-xs text-red-600 dark:text-red-400 list-disc list-inside">
              {slugIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="abstract">Abstract</Label>
          <Textarea
            id="abstract"
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            placeholder="Brief description of what this project documents…"
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="subject">Intended Subject</Label>
          <Input
            id="subject"
            value={intendedSubject}
            onChange={(e) => setIntendedSubject(e.target.value)}
            placeholder="e.g. temple, ritual, deity, person"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="visibility">Visibility</Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger id="visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private — only you and collaborators</SelectItem>
              <SelectItem value="org">Organization — visible to org members</SelectItem>
              <SelectItem value="public">Public — visible to everyone</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="temple, patan, iconography  (comma-separated)"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={submitting || slugInvalid}>
            {submitting ? "Creating…" : "Create Project"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/contribute/projects")}>
            Cancel
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
