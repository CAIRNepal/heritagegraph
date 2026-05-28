"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  IconFocus2,
  IconLoader2,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { glassCard } from "@/lib/design";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  fetchProjectGraph,
  type ProjectGraphNode,
  type ProjectGraphPayload,
} from "@/lib/projects-api";
import { culturalEntityKnowledgePath, projectWorkspacePath } from "@/lib/project-contribute";
import { INSTANCE_CATEGORY_COLORS } from "@/lib/instance-graph";

/* eslint-disable @typescript-eslint/no-explicit-any */
let cytoscapeReady = false;
let cytoscape: any = null;

const EVIDENCE_COLOR = {
  bg: "#64748b",
  border: "#475569",
  text: "#fff",
  label: "Evidence",
  icon: "📎",
};

const LAYOUT = {
  name: "cose-bilkent",
  animate: true,
  animationDuration: 600,
  idealEdgeLength: 120,
  nodeRepulsion: 8000,
  fit: true,
  padding: 40,
};

function nodeColor(category: string) {
  if (category === "evidence") return EVIDENCE_COLOR;
  const c = INSTANCE_CATEGORY_COLORS[category as keyof typeof INSTANCE_CATEGORY_COLORS];
  return c ?? EVIDENCE_COLOR;
}

function buildElements(data: ProjectGraphPayload) {
  const elements: { group: string; data: Record<string, unknown> }[] = [];
  for (const n of data.nodes) {
    const colors = nodeColor(n.category);
    elements.push({
      group: "nodes",
      data: {
        id: n.id,
        label: n.label,
        category: n.category,
        bg: colors.bg,
        border: colors.border,
        text: colors.text,
        description: n.description,
      },
    });
  }
  for (const e of data.edges) {
    elements.push({
      group: "edges",
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
      },
    });
  }
  return elements;
}

const CY_STYLES = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "text-valign": "center",
      "text-halign": "center",
      "font-size": "10px",
      color: "data(text)",
      "background-color": "data(bg)",
      "border-color": "data(border)",
      "border-width": 2,
      width: 36,
      height: 36,
      "text-wrap": "wrap",
      "text-max-width": "80px",
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "#94a3b8",
      "target-arrow-color": "#94a3b8",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      label: "data(label)",
      "font-size": "8px",
      color: "#64748b",
    },
  },
];

export function ProjectGraphClient({
  projectSlug,
  projectTitle,
}: {
  projectSlug: string;
  projectTitle?: string;
}) {
  const { data: session } = useSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<ProjectGraphPayload | null>(null);
  const [selected, setSelected] = useState<ProjectGraphNode | null>(null);

  const ensureCytoscape = useCallback(async () => {
    if (cytoscapeReady) return;
    const [cyMod, coseMod] = await Promise.all([
      import("cytoscape"),
      import("cytoscape-cose-bilkent"),
    ]);
    cytoscape = cyMod.default;
    const cose = coseMod.default;
    if (typeof cose === "function") cytoscape.use(cose);
    cytoscapeReady = true;
  }, []);

  const mountGraph = useCallback((data: ProjectGraphPayload) => {
    if (!cytoscape || !containerRef.current) return;
    cyRef.current?.destroy();
    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(data),
      style: CY_STYLES,
      layout: LAYOUT,
      minZoom: 0.2,
      maxZoom: 4,
    });
    cy.on("tap", "node", (evt: any) => {
      const id = evt.target.id();
      const node = data.nodes.find((n) => n.id === id);
      if (node) setSelected(node);
    });
    cy.on("tap", (evt: any) => {
      if (evt.target === cy) setSelected(null);
    });
    cyRef.current = cy;
  }, []);

  useEffect(() => {
    const token = (session as { accessToken?: string } | null)?.accessToken;
    setLoading(true);
    setError(null);
    fetchProjectGraph(projectSlug, token)
      .then(async (data) => {
        setGraphData(data);
        await ensureCytoscape();
        mountGraph(data);
      })
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [projectSlug, session, ensureCytoscape, mountGraph]);

  const runLayout = () => {
    cyRef.current?.layout(LAYOUT).run();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={projectWorkspacePath(projectSlug)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to project
          </Link>
          <h1 className="text-xl font-bold mt-1">
            {projectTitle ? `${projectTitle} — graph` : "Project graph"}
          </h1>
          <p className="text-xs text-muted-foreground">
            Only entities and evidence in this dossier are shown.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}>
            <IconZoomIn className="w-4 h-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}>
            <IconZoomOut className="w-4 h-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => cyRef.current?.fit(undefined, 40)}>
            <IconFocus2 className="w-4 h-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={runLayout}>
            Re-layout
          </Button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <IconLoader2 className="w-4 h-4 animate-spin" /> Loading graph…
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex flex-1 min-h-0 gap-4">
        <div className={`${glassCard} flex-1 min-h-[320px] relative overflow-hidden`}>
          <div ref={containerRef} className="absolute inset-0" />
          {!loading && graphData && graphData.nodes.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Link entities to this project to see them here.
            </p>
          )}
        </div>
        {selected && (
          <aside className={`${glassCard} w-72 shrink-0 p-4 space-y-2 overflow-y-auto`}>
            <h2 className="font-semibold text-sm">{selected.label}</h2>
            <Badge variant="outline" className="text-xs">
              {selected.category}
            </Badge>
            {selected.description && (
              <p className="text-xs text-muted-foreground line-clamp-6">{selected.description}</p>
            )}
            {!String(selected.id).startsWith("asset-") && (
              <Button type="button" size="sm" variant="link" className="px-0" asChild>
                <Link href={culturalEntityKnowledgePath(selected.id)}>View record</Link>
              </Button>
            )}
          </aside>
        )}
      </div>
      {graphData && (
        <p className="text-xs text-muted-foreground text-center">
          {graphData.nodes.length} nodes · {graphData.edges.length} edges
        </p>
      )}
    </div>
  );
}
