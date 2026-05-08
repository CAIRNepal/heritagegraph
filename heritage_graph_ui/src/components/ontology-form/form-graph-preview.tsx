"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { compactIri, type FormGraph } from "@/lib/ontology/form-graph";

interface OntologyFormGraphPreviewProps {
  graph: FormGraph;
  jsonLd: Record<string, unknown>;
}

export function OntologyFormGraphPreview({
  graph,
  jsonLd,
}: OntologyFormGraphPreviewProps) {
  const jsonText = useMemo(() => JSON.stringify(jsonLd, null, 2), [jsonLd]);

  async function copyJsonLd() {
    try {
      await navigator.clipboard.writeText(jsonText);
      toast.success("JSON-LD copied to clipboard.");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  return (
    <Accordion type="single" collapsible className="rounded-lg border bg-card">
      <AccordionItem value="form-graph" className="border-0 px-3">
        <AccordionTrigger className="py-3 text-sm hover:no-underline">
          Semantic graph preview (derived from this form)
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pb-4 pt-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Read-only projection: triples inferred from registry{" "}
            <code className="font-mono text-[11px]">slot_uri</code> links and literals. Matches
            server naming from{" "}
            <code className="font-mono text-[11px]">
              RDF_RESOURCE_BASE_URI / model / id
            </code>
            .
          </p>
          <div className="rounded-md border overflow-x-auto max-h-[14rem] overflow-y-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b bg-muted/50 text-left [&_th]:px-2 [&_th]:py-1.5">
                  <th>Subject</th>
                  <th>Predicate</th>
                  <th>Object</th>
                </tr>
              </thead>
              <tbody>
                {graph.edges.map((edge, idx) => {
                  const obj =
                    edge.objectUri != null ? (
                      compactIri(edge.objectUri)
                    ) : edge.objectLiteral !== undefined ? (
                      <span className="break-all">
                        {String(edge.objectLiteral)}
                      </span>
                    ) : (
                      "—"
                    );
                  return (
                    <tr
                      key={`${edge.subject}-${edge.predicate}-${idx}`}
                      className="border-b border-border/60 last:border-0 align-top [&_td]:px-2 [&_td]:py-1"
                    >
                      <td className="whitespace-nowrap text-muted-foreground">
                        {compactIri(edge.subject)}
                      </td>
                      <td>{compactIri(edge.predicate)}</td>
                      <td>{obj}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void copyJsonLd()}
              className="gap-2"
            >
              <ClipboardList className="h-4 w-4" aria-hidden />
              Copy JSON-LD
            </Button>
          </div>
          <pre className="max-h-[12rem] overflow-auto rounded-md border bg-muted/30 p-3 text-[11px] leading-snug whitespace-pre-wrap break-all">
            {jsonText}
          </pre>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
