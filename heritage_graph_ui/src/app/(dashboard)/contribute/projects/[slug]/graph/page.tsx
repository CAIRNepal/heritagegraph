"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { ProjectGraphClient } from "@/components/projects/project-graph-client";
import { getProject } from "@/lib/projects-api";

export default function ProjectGraphPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const [title, setTitle] = useState<string | undefined>();

  useEffect(() => {
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!slug || !token) return;
    getProject(slug, token)
      .then((p) => setTitle(p.title))
      .catch(() => setTitle(undefined));
  }, [slug, session]);

  if (!slug) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Invalid project.</p>;
  }

  return <ProjectGraphClient projectSlug={slug} projectTitle={title} />;
}
