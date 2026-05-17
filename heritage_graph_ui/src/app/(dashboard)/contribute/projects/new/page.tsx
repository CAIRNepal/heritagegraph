"use client";

import { useState } from "react";
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
import { getApiErrorMessage } from "@/lib/api-client";
import { createProject } from "@/lib/projects-api";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export default function NewProjectPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [abstract, setAbstract] = useState("");
  const [intendedSubject, setIntendedSubject] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [tagsRaw, setTagsRaw] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    setSlug(slugify(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!token) return;
    if (!title.trim() || !slug.trim()) {
      setError("Title and slug are required.");
      return;
    }

    setSubmitting(true);
    setError("");

    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const project = await createProject(token, {
        title: title.trim(),
        slug: slug.trim(),
        abstract: abstract.trim(),
        intended_subject: intendedSubject.trim(),
        visibility,
        tags,
        languages: [],
      });
      router.push(`/contribute/projects/${project.slug}`);
    } catch (err) {
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
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="auto-filled from title"
            required
          />
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
          <Button type="submit" disabled={submitting}>
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
