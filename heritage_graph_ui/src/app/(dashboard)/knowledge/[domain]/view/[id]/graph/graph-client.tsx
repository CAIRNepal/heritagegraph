"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import cytoscape, { type Core } from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import { Button } from "@/components/ui/button";
import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { OntologyUnavailablePanel } from "@/components/ontology/OntologyUnavailablePanel";

let coseRegistered = false;
if (!coseRegistered) {
  cytoscape.use(coseBilkent);
  coseRegistered = true;
}

const API = getPublicApiUrl();

const CAT_COLOR: Record<string, string> = {
  tangible: "#b45309",
  conceptual: "#7c3aed",
  event: "#0d9488",
  social: "#2563eb",
  spatiotemporal: "#db2777",
  provenance: "#4b5563",
  kumari: "#ca8a04",
  default: "#64748b",
};

interface RelatedRow {
  id: string;
  domain_key: string;
  name: string;
  summary: string;
  display_type: string;
}

interface RelatedGroup {
  domain_key: string;
  results: RelatedRow[];
}

interface RelatedResponse {
  groups: RelatedGroup[];
}

export default function RelatedGraphPageClient() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { getOntologyClass } = useOntology();
  const domain = params.domain as string;
  const id = params.id as string;
  const ontologyClass = getOntologyClass(domain);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ontologyClass?.apiEndpoint.startsWith("/cidoc/")) {
      setError("Graph explorer is only available for CIDOC entities.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = (session as { accessToken?: string } | null)?.accessToken;
      const url = `${API}/cidoc/related/?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(id)}&page_size=50`;
      const data = await apiFetchJson<RelatedResponse>(url, {
        headers: token
          ? { Authorization: `Bearer ${token}`, Accept: "application/json" }
          : { Accept: "application/json" },
      });
      const rows: RelatedRow[] = [];
      for (const g of data.groups || []) {
        rows.push(...(g.results || []));
      }
      const centerId = `center:${domain}:${id}`;
      const elements: cytoscape.ElementDefinition[] = [
        {
          data: {
            id: centerId,
            label: `${ontologyClass.label} #${id}`,
            fill: "#0f172a",
            isCenter: "1",
            domain: domain,
            entityId: id,
          },
        },
      ];
      const seen = new Set<string>();
      for (const r of rows) {
        const nid = `${r.domain_key}:${r.id}`;
        if (seen.has(nid)) continue;
        seen.add(nid);
        const cls = getOntologyClass(r.domain_key);
        const fill =
          CAT_COLOR[String(cls?.category || "default")] || CAT_COLOR.default;
        elements.push({
          data: {
            id: nid,
            label: r.name || r.display_type,
            fill,
            domain: r.domain_key,
            entityId: r.id,
          },
        });
        elements.push({
          data: {
            id: `e-${centerId}-${nid}`,
            source: centerId,
            target: nid,
          },
        });
      }
      if (!containerRef.current) return;
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          {
            selector: "node",
            style: {
              label: "data(label)",
              "text-wrap": "wrap",
              "text-max-width": "120px",
              "font-size": "11px",
              color: "#0f172a",
              "background-color": "data(fill)",
              width: 38,
              height: 38,
              "border-width": 2,
              "border-color": "#fff",
            },
          },
          {
            selector: "node[isCenter]",
            style: {
              color: "#fff",
              width: 46,
              height: 46,
            },
          },
          {
            selector: "edge",
            style: {
              width: 2,
              "line-color": "#94a3b8",
              "target-arrow-color": "#94a3b8",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
            },
          },
        ],
        layout: {
          name: "cose-bilkent",
          animate: true,
          fit: true,
          padding: 36,
        } as cytoscape.LayoutOptions,
      });
      cy.on("tap", "node", (evt) => {
        const d = evt.target.data() as {
          isCenter?: string;
          domain?: string;
          entityId?: string;
        };
        if (d.isCenter === "1") return;
        if (d.domain && d.entityId) {
          router.push(
            `/knowledge/${d.domain}/view/${encodeURIComponent(String(d.entityId))}`,
          );
        }
      });
      cyRef.current = cy;
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load related entities."));
    } finally {
      setLoading(false);
    }
  }, [domain, id, getOntologyClass, ontologyClass, router, session]);

  useEffect(() => {
    void load();
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [load]);

  if (!ontologyClass) {
    return <OntologyUnavailablePanel variant="knowledge" missingKey={domain} />;
  }

  return (
    <div className="space-y-4 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.push(`/knowledge/${domain}/view/${encodeURIComponent(id)}`)
          }
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to record
        </Button>
        <h1 className="text-xl font-semibold">Relation graph</h1>
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Neighbors from <code className="text-xs">/cidoc/related/</code>. Tap a node to open that
        record.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div
        ref={containerRef}
        className="h-[min(70vh,520px)] w-full rounded-lg border bg-muted/20"
        role="img"
        aria-label="Relation graph visualization"
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading graph…</p>
      ) : null}
    </div>
  );
}
