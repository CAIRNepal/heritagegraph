"use client";

import Link from "next/link";
import { IconFolders } from "@tabler/icons-react";
import { glassCard } from "@/lib/design";

export function ProjectContributeBanner({ slug, title }: { slug: string; title?: string }) {
  return (
    <div
      className={`${glassCard} mb-4 flex items-center gap-3 border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/30 px-4 py-3`}
    >
      <IconFolders className="w-5 h-5 text-violet-600 shrink-0" />
      <p className="text-sm flex-1">
        Contributing to project:{" "}
        <span className="font-medium">{title ?? slug}</span>
      </p>
      <Link
        href={`/contribute/projects/${slug}`}
        className="text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline shrink-0"
      >
        Back to workspace
      </Link>
    </div>
  );
}
