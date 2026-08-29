"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { IconX } from "@tabler/icons-react";
import { fadeInUp, glassCard } from "@/lib/design";
import { getApiErrorMessage, isApiError } from "@/lib/api-client";
import { createProject, getProject } from "@/lib/projects-api";

const DRAFT_KEY = "hg-project-draft-v1";

const LICENSES = [
  { value: "CC-BY-4.0", label: "CC BY 4.0 — Attribution" },
  { value: "CC-BY-SA-4.0", label: "CC BY-SA 4.0 — Attribution-ShareAlike" },
  { value: "CC-BY-NC-4.0", label: "CC BY-NC 4.0 — Non-commercial" },
  { value: "CC0-1.0", label: "CC0 1.0 — Public Domain" },
  { value: "ODbL-1.0", label: "ODbL 1.0 — Open Database" },
];

const LANGUAGE_SUGGESTIONS = [
  { tag: "ne", label: "Nepali" },
  { tag: "en", label: "English" },
  { tag: "new", label: "Newari" },
  { tag: "mai", label: "Maithili" },
  { tag: "hi", label: "Hindi" },
  { tag: "sa", label: "Sanskrit" },
];

const INTENDED_SUBJECT_PRESETS = [
  { label: "Temple / monument in Bhaktapur", value: "temple monument Bhaktapur" },
  { label: "Ritual or festival", value: "ritual festival" },
  { label: "Heritage place / site", value: "place site location" },
  { label: "Historical person", value: "person biography" },
  { label: "Architectural structure", value: "structure monument" },
];

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
  const [license, setLicense] = useState("CC-BY-4.0");
  const [visibility, setVisibility] = useState("private");
  const [languages, setLanguages] = useState<string[]>(["ne"]);
  const [langInput, setLangInput] = useState("");
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
      if (typeof o.license === "string") setLicense(o.license);
      if (typeof o.visibility === "string") setVisibility(o.visibility);
      if (Array.isArray(o.languages)) setLanguages(o.languages as string[]);
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
          license,
          visibility,
          languages,
          tagsRaw,
        })
      );
    } catch {
      /* ignore quota */
    }
  }, [abstract, intendedSubject, license, languages, restoredDraft, slug, tagsRaw, title, visibility]);

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
          languages,
          license,
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
        <h1 className="text-2xl font-bold text-primary dark:text-primary">New Project</h1>
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
          <div className="flex flex-wrap gap-2 mb-2">
            {INTENDED_SUBJECT_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                size="sm"
                variant={intendedSubject === preset.value ? "default" : "outline"}
                className="text-xs"
                onClick={() => setIntendedSubject(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Input
            id="subject"
            value={intendedSubject}
            onChange={(e) => setIntendedSubject(e.target.value)}
            placeholder="e.g. temple, ritual, deity, person"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="license">License</Label>
            <Select value={license} onValueChange={setLicense}>
              <SelectTrigger id="license">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LICENSES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Data license — propagates to DCAT metadata on merge.
            </p>
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
        </div>

        <div className="space-y-1.5">
          <Label>Languages</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {LANGUAGE_SUGGESTIONS.map((lang) => (
              <Button
                key={lang.tag}
                type="button"
                size="sm"
                variant={languages.includes(lang.tag) ? "default" : "outline"}
                className="text-xs h-7 px-2.5"
                onClick={() =>
                  setLanguages((prev) =>
                    prev.includes(lang.tag)
                      ? prev.filter((l) => l !== lang.tag)
                      : [...prev, lang.tag]
                  )
                }
              >
                {lang.tag} — {lang.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              id="lang-input"
              value={langInput}
              onChange={(e) => setLangInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === ",") && langInput.trim()) {
                  e.preventDefault();
                  const tag = langInput.trim().toLowerCase().replace(/[^a-z-]/g, "");
                  if (tag && !languages.includes(tag)) {
                    setLanguages((prev) => [...prev, tag]);
                  }
                  setLangInput("");
                }
              }}
              placeholder="Add BCP-47 tag (e.g. fr, zh-Hant)"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const tag = langInput.trim().toLowerCase().replace(/[^a-z-]/g, "");
                if (tag && !languages.includes(tag)) {
                  setLanguages((prev) => [...prev, tag]);
                }
                setLangInput("");
              }}
            >
              Add
            </Button>
          </div>
          {languages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {languages.map((lang) => (
                <Badge key={lang} variant="secondary" className="gap-1 text-xs pr-1">
                  {lang}
                  <button
                    type="button"
                    onClick={() => setLanguages((prev) => prev.filter((l) => l !== lang))}
                    className="hover:text-destructive transition-colors"
                    aria-label={`Remove ${lang}`}
                  >
                    <IconX className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
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
