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
import { getPublicApiUrl } from "@/lib/api-base";

interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  abstract: string;
  state: string;
  visibility: string;
  owner: { id: string; username: string; email: string };
  forked_from: string | null;
  asset_count: number;
  entity_count: number;
  collaborator_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const STATE_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  needs_revision: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  merged: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  withdrawn: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

const STATE_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  needs_revision: "Needs Revision",
  approved: "Approved",
  merged: "Merged",
  withdrawn: "Withdrawn",
};

function ProjectCard({ project }: { project: ProjectSummary }) {
  const router = useRouter();
  const stateColor = STATE_COLORS[project.state] ?? STATE_COLORS.draft;

  return (
    <motion.div variants={scaleIn} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <div
        className={`${glassCard} p-5 cursor-pointer hover:shadow-xl transition-all duration-200`}
        onClick={() => router.push(`/contribute/projects/${project.slug}`)}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 line-clamp-1 flex-1">
            {project.title}
          </h3>
          <Badge className={`${stateColor} text-[11px] px-2 py-0.5 shrink-0`}>
            {STATE_LABELS[project.state] ?? project.state}
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
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {project.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ProjectsListPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!session?.accessToken) return;
    const base = getPublicApiUrl();
    fetch(`${base}/api/v1/data/projects/?ordering=-updated_at`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
    })
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : (data.results ?? []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session]);

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
