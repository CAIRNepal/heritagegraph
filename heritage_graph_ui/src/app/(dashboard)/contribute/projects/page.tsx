"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { IconPlus, IconSearch, IconFolders, IconGitFork } from "@tabler/icons-react";
import { fadeInUp, staggerContainer, scaleIn, glassCard } from "@/lib/design";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  listProjects,
  PROJECT_STATE_LABELS,
  type ProjectSummary,
} from "@/lib/projects-api";

const STATE_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  needs_revision: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  merged: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  withdrawn: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

function ProjectCard({ project }: { project: ProjectSummary }) {
  const router = useRouter();
  const stateColor = STATE_COLORS[project.state] ?? STATE_COLORS.draft;

  return (
    <motion.div variants={scaleIn} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <motion.div
        role="button"
        tabIndex={0}
        className={`${glassCard} p-5 cursor-pointer hover:shadow-xl transition-all duration-200`}
        onClick={() => router.push(`/contribute/projects/${project.slug}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            router.push(`/contribute/projects/${project.slug}`);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 line-clamp-1 flex-1">
            {project.title}
          </h3>
          <Badge className={`${stateColor} text-[11px] px-2 py-0.5 shrink-0`}>
            {PROJECT_STATE_LABELS[project.state] ?? project.state}
          </Badge>
        </div>
        {project.abstract && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.abstract}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{project.entity_count} entities</span>
          <span>{project.asset_count} assets</span>
          {project.collaborator_count > 0 && (
            <span>{project.collaborator_count} collaborators</span>
          )}
          {project.forked_from && (
            <span className="flex items-center gap-1">
              <IconGitFork className="w-3 h-3" /> fork
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ProjectsListPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = () => {
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!token) {
      setLoading(authStatus === "loading");
      return;
    }
    setLoading(true);
    setError(null);
    listProjects(token)
      .then(setProjects)
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, authStatus]);

  const filtered = projects.filter(
    (p) =>
      !search.trim() ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.abstract.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className={`relative overflow-hidden ${glassCard} p-6`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-500 to-indigo-500 opacity-90 rounded-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-white/80 text-xs font-medium">
              <IconFolders className="w-4 h-4" /> My Projects
            </div>
            <h1 className="text-2xl font-bold text-white">Contribution Projects</h1>
            <p className="text-purple-100 text-sm">
              Each project is a working dossier — collect evidence, author entities, request review.
            </p>
          </div>
          <Button
            onClick={() => router.push("/contribute/projects/new")}
            className="shrink-0 bg-white text-purple-700 hover:bg-purple-50"
          >
            <IconPlus className="w-4 h-4 mr-1.5" /> New Project
          </Button>
        </div>
      </motion.div>

      <motion.div initial="hidden" animate="show" variants={fadeInUp} className="relative">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11 rounded-xl"
        />
      </motion.div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading projects…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <IconFolders className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {search ? "No projects match your search." : "You have no projects yet."}
          </p>
          {!search && (
            <Button variant="outline" onClick={() => router.push("/contribute/projects/new")}>
              Start your first project
            </Button>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
}
