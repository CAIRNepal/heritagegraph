"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconPlus,
  IconSearch,
  IconFolders,
  IconGitFork,
  IconArrowRight,
  IconFileCheck,
  IconArchive,
  IconQuote,
} from "@tabler/icons-react";
import { fadeInUp, staggerContainer, scaleIn, glassCard } from "@/lib/design";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  listProjectsPage,
  PROJECT_STATE_LABELS,
  type ProjectSummary,
} from "@/lib/projects-api";
import { ProjectCardSkeleton } from "@/components/projects/project-card-skeleton";

const STATE_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  needs_revision: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  merged: "bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary",
  withdrawn: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

function ProjectCardActions({ project }: { project: ProjectSummary }) {
  const router = useRouter();

  switch (project.state) {
    case "draft":
      return (
        <>
          <Button
            size="sm"
            variant="default"
            className="gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/contribute/projects/${project.slug}`);
            }}
          >
            Continue <IconArrowRight className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/contribute/projects/${project.slug}`);
            }}
          >
            <IconFileCheck className="w-3.5 h-3.5" /> Open Merge Request
          </Button>
        </>
      );
    case "in_review":
    case "needs_revision":
      return (
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/contribute/projects/${project.slug}`);
          }}
        >
          View <IconArrowRight className="w-3.5 h-3.5" />
        </Button>
      );
    case "merged":
      return (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/contribute/projects/${project.slug}`);
            }}
          >
            <IconArchive className="w-3.5 h-3.5" /> View archive
          </Button>
          {project.tags?.includes("doi") && (
            <Button size="sm" variant="outline" className="gap-1 text-xs" asChild>
              <a href="#" target="_blank" rel="noopener noreferrer">
                <IconQuote className="w-3.5 h-3.5" /> Cite dataset
              </a>
            </Button>
          )}
        </>
      );
    default:
      return null;
  }
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const router = useRouter();
  const stateColor = STATE_COLORS[project.state] ?? STATE_COLORS.draft;
  const updatedDate = new Date(project.updated_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <motion.div variants={scaleIn} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <div
        role="button"
        tabIndex={0}
        className={`${glassCard} p-5 cursor-pointer hover:shadow-xl transition-all duration-200 flex flex-col gap-3`}
        onClick={() => router.push(`/contribute/projects/${project.slug}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            router.push(`/contribute/projects/${project.slug}`);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <IconFolders className="w-4 h-4 text-primary shrink-0" />
            <h3 className="font-semibold text-primary dark:text-primary line-clamp-1">
              {project.title}
            </h3>
          </div>
          <Badge className={`${stateColor} text-[11px] px-2 py-0.5 shrink-0`}>
            {PROJECT_STATE_LABELS[project.state] ?? project.state}
          </Badge>
        </div>

        {project.abstract && (
          <p className="text-sm text-muted-foreground line-clamp-2">{project.abstract}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{project.entity_count} entities</span>
          <span>{project.asset_count} assets</span>
          {project.collaborator_count > 0 && (
            <span>You + {project.collaborator_count} member{project.collaborator_count !== 1 ? "s" : ""}</span>
          )}
          {project.forked_from && (
            <span className="flex items-center gap-1">
              <IconGitFork className="w-3 h-3" /> fork
            </span>
          )}
          <span className="ml-auto">Updated {updatedDate}</span>
        </div>

        <div
          className="flex flex-wrap gap-2 pt-0.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="group"
          aria-label="Project actions"
        >
          <ProjectCardActions project={project} />
        </div>
      </div>
    </motion.div>
  );
}

type ListScope = "mine" | "public";
type StateFilter = "all" | "draft" | "in_review" | "needs_revision" | "approved" | "merged" | "withdrawn";

const STATE_FILTER_LABELS: Record<StateFilter, string> = {
  all: "All states",
  draft: "Draft",
  in_review: "In Review",
  needs_revision: "Needs Revision",
  approved: "Approved",
  merged: "Merged",
  withdrawn: "Withdrawn",
};

export default function ProjectsListPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [listScope, setListScope] = useState<ListScope>("mine");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const token = (session as { accessToken?: string } | null)?.accessToken;

  const fetchFirstPage = useCallback(async () => {
    if (!token && authStatus !== "loading") return;
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const opts: Parameters<typeof listProjectsPage>[1] = {};
      if (listScope === "public") opts.visibility = "public";
      if (stateFilter !== "all") opts.state = stateFilter;

      const page = await listProjectsPage(token, opts);
      setProjects(page.results);
      setNextUrl(page.next);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setProjects([]);
      setNextUrl(null);
    } finally {
      setLoading(false);
    }
  }, [token, authStatus, listScope, stateFilter]);

  useEffect(() => {
    if (authStatus === "loading") {
      setLoading(true);
      return;
    }
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchFirstPage();
  }, [token, authStatus, listScope, stateFilter, fetchFirstPage]);

  const loadMore = async () => {
    if (!token || !nextUrl || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const opts: Parameters<typeof listProjectsPage>[1] = { nextUrl };
      if (listScope === "public") opts.visibility = "public";
      if (stateFilter !== "all") opts.state = stateFilter;

      const page = await listProjectsPage(token, opts);
      setProjects((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const appended = page.results.filter((p) => !seen.has(p.id));
        return [...prev, ...appended];
      });
      setNextUrl(page.next);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = projects.filter(
    (p) =>
      !search.trim() ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.abstract ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const skeletonGrid = (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((k) => (
        <ProjectCardSkeleton key={k} />
      ))}
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className={`relative overflow-hidden ${glassCard} p-6`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-hero-from via-hero-to to-hero-to opacity-90 rounded-2xl" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white/80 text-xs font-medium flex-wrap">
              <IconFolders className="w-4 h-4" /> Contribution Projects
            </div>
            <h1 className="text-2xl font-bold text-white">Your dossiers</h1>
            <p className="text-hero-foreground/90 text-sm">
              Collect evidence, author entities, and request review.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant={listScope === "mine" ? "default" : "secondary"}
                className={
                  listScope === "mine"
                    ? "bg-white text-primary hover:bg-primary/10"
                    : "bg-white/15 text-white border-white/30 hover:bg-white/25"
                }
                onClick={() => setListScope("mine")}
              >
                My projects
              </Button>
              <Button
                type="button"
                size="sm"
                variant={listScope === "public" ? "default" : "secondary"}
                className={
                  listScope === "public"
                    ? "bg-white text-primary hover:bg-primary/10"
                    : "bg-white/15 text-white border-white/30 hover:bg-white/25"
                }
                onClick={() => setListScope("public")}
              >
                Public projects
              </Button>
            </div>
          </div>
          <Button
            onClick={() => router.push("/contribute/projects/new")}
            className="shrink-0 bg-white text-primary hover:bg-primary/10"
          >
            <IconPlus className="w-4 h-4 mr-1.5" /> New Project
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-xl"
          />
        </div>
        <Select
          value={stateFilter}
          onValueChange={(v) => setStateFilter(v as StateFilter)}
        >
          <SelectTrigger className="h-11 w-full sm:w-44 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATE_FILTER_LABELS) as StateFilter[]).map((key) => (
              <SelectItem key={key} value={key}>
                {STATE_FILTER_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void fetchFirstPage()}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        skeletonGrid
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <IconFolders className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {search
              ? "No projects match your search."
              : listScope === "public"
                ? "No public projects found."
                : "You have no projects yet."}
          </p>
          {!search && listScope === "mine" && (
            <Button variant="outline" onClick={() => router.push("/contribute/projects/new")}>
              Start your first project
            </Button>
          )}
        </div>
      ) : (
        <>
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerContainer}
            className="grid gap-4 sm:grid-cols-2"
          >
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </motion.div>
          {nextUrl && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
