import type { Metadata } from "next";

import { getInternalBackendUrl } from "@/lib/api-base";
import EntityViewPageClient from "./page-client";

// Public, crawlable entity pages get rich link previews (OpenGraph + Twitter)
// so shares unfurl with the entity's real name/description. Falls back safely.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let name = "Heritage entity";
  let description =
    "A cultural-heritage entity in the HeritageGraph knowledge graph.";

  try {
    const res = await fetch(
      `${getInternalBackendUrl()}/data/api/cultural-entities/${id}/`,
      { headers: { Accept: "application/json" }, next: { revalidate: 300 } },
    );
    if (res.ok) {
      const d = (await res.json()) as Record<string, unknown>;
      name = (d.name as string) || (d.title as string) || name;
      if (d.description) description = String(d.description).slice(0, 200);
    }
  } catch {
    /* backend unreachable at build/request time — use the safe defaults */
  }

  const title = `${name} · HeritageGraph`;
  const url = `/knowledge/entity/view/${id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "HeritageGraph",
    },
    twitter: { card: "summary", title, description },
  };
}

export default function Page() {
  return <EntityViewPageClient />;
}
