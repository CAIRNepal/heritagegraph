"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  ReactFlowProvider,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTabularImportJob,
  fetchTabularCompilePreview,
  patchTabularImportJob,
  type DocumentCompilePreviewPayload,
  type TabularImportJobPayload,
} from "@/lib/ingestion-api";
import type { OntologyRegistry } from "@/lib/ontology/types";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { cn } from "@/lib/utils";

function collectRegistryFieldKeys(registry: OntologyRegistry): string[] {
  const keys = new Set<string>();
  const classes = registry.classes ?? {};
  for (const cls of Object.values(classes)) {
    for (const f of cls.fields ?? []) {
      if (f.key) keys.add(String(f.key));
    }
  }
  return [...keys].sort();
}

export function TabularIngestionWizard() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken ?? null;
  const { registry } = useOntology();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [file, setFile] = useState<File | null>(null);
  const [provInst, setProvInst] = useState("");
  const [provColl, setProvColl] = useState("");
  const [provLang, setProvLang] = useState("");
  const [job, setJob] = useState<TabularImportJobPayload | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [compilePreview, setCompilePreview] = useState<DocumentCompilePreviewPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const fieldKeys = useMemo(() => collectRegistryFieldKeys(registry), [registry]);
  const columns = useMemo(() => {
    const rows = job?.staged_rows ?? [];
    if (!rows.length) return [];
    return Object.keys(rows[0] ?? {}).sort();
  }, [job]);

  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePatchMapping = useCallback(
    (mapping: Record<string, string>) => {
      if (!job?.id || !token) return;
      if (patchTimer.current) clearTimeout(patchTimer.current);
      patchTimer.current = setTimeout(() => {
        void patchTabularImportJob({
          jobId: job.id,
          accessToken: token,
          patch: { column_mapping: mapping },
        })
          .then(setJob)
          .catch(() => {});
      }, 600);
    },
    [job?.id, token]
  );

  useEffect(() => {
    return () => {
      if (patchTimer.current) clearTimeout(patchTimer.current);
    };
  }, []);

  const canRun = status === "authenticated" && Boolean(token);

  const uploadTabular = async () => {
    if (!token || !file) {
      toast.error("Choose a CSV or Excel file.");
      return;
    }
    setBusy(true);
    try {
      const created = await createTabularImportJob({
        file,
        accessToken: token,
        provenance: {
          source_institution: provInst,
          collection_name: provColl,
          language: provLang,
        },
      });
      setJob(created);
      const cols = created.staged_rows?.length
        ? Object.keys(created.staged_rows[0]).sort()
        : [];
      const nextMap: Record<string, string> = {};
      for (const c of cols) {
        nextMap[c] = (created.column_mapping?.[c] as string) || "";
      }
      setColumnMapping(nextMap);
      setStep(1);
      if (!created.staged_rows?.length) {
        toast.error(created.user_safe_error || "No rows parsed.");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const loadCompile = async () => {
    if (!job?.id || !token) return;
    setBusy(true);
    try {
      const data = await fetchTabularCompilePreview({ jobId: job.id, accessToken: token });
      setCompilePreview(data);
      setStep(2);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Compile preview failed.");
    } finally {
      setBusy(false);
    }
  };

  const rowSlice = (job?.staged_rows ?? []).slice(0, 40);

  const flowGraph = useMemo(() => {
    if (!compilePreview?.entities?.length) return { nodes: [] as Node[], edges: [] as Edge[] };
    const entities = compilePreview.entities;
    const rels = compilePreview.relations ?? [];
    const nodes: Node[] = entities.map((e, i) => ({
      id: e.id,
      position: { x: (i % 4) * 190, y: Math.floor(i / 4) * 88 },
      data: { label: `${e.kind ?? e.entity_type ?? "?"}: ${(e.label ?? "").slice(0, 40)}` },
      style: { fontSize: 10, width: 170 },
    }));
    const edges: Edge[] = rels.map((r, i) => ({
      id: `t-${i}`,
      source: r.source,
      target: r.target,
      label: r.label ?? "",
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 1 },
    }));
    return { nodes, edges };
  }, [compilePreview]);

  const toggleRowSkip = async (rowIndex: number) => {
    if (!job?.id || !token) return;
    const cur = job.row_review_state[String(rowIndex)] as { skip?: boolean } | undefined;
    const nextSkip = !cur?.skip;
    try {
      const updated = await patchTabularImportJob({
        jobId: job.id,
        accessToken: token,
        patch: {
          row_review_state: {
            [String(rowIndex)]: { skip: nextSkip },
          },
        },
      });
      setJob(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update row.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link
          href="/contribute/ingestion"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Document ingestion
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Spreadsheet ingestion</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          CSV or Excel → column mapping against ontology field keys → server compile-preview graph.
          Row marks are stored as draft review state (no automatic KG writes).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={step === 0 ? "default" : "outline"}>1. Upload</Badge>
        <Badge variant={step === 1 ? "default" : "outline"}>2. Map columns</Badge>
        <Badge variant={step === 2 ? "default" : "outline"}>3. Preview</Badge>
      </div>

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV / XLSX</CardTitle>
            <CardDescription>Headers become column keys for mapping.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              disabled={!canRun || busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Source institution</Label>
                <Input value={provInst} onChange={(e) => setProvInst(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Collection</Label>
                <Input value={provColl} onChange={(e) => setProvColl(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Language</Label>
                <Input value={provLang} onChange={(e) => setProvLang(e.target.value)} />
              </div>
            </div>
            <Button
              type="button"
              disabled={!canRun || !file || busy}
              onClick={() => void uploadTabular()}
            >
              Parse file
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step >= 1 && job ? (
        <Card>
          <CardHeader>
            <CardTitle>Column mapping</CardTitle>
            <CardDescription>
              Map each spreadsheet column to an ontology field key (human-facing labels in the
              registry). Mapping autosaves.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground font-mono">
              Job {job.id} · {job.staged_rows?.length ?? 0} rows · {job.source_filename}
            </p>
            <div className="grid gap-3">
              {columns.map((col) => (
                <div key={col} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[140px] max-w-[220px] truncate text-sm font-medium">
                    {col}
                  </span>
                  <Select
                    value={columnMapping[col] || "__skip__"}
                    onValueChange={(v) => {
                      const val = v === "__skip__" ? "" : v;
                      const next = { ...columnMapping, [col]: val };
                      setColumnMapping(next);
                      schedulePatchMapping(next);
                    }}
                  >
                    <SelectTrigger className="w-[260px]">
                      <SelectValue placeholder="Ontology field key" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip__">(no mapping)</SelectItem>
                      {fieldKeys.map((k) => (
                        <SelectItem key={k} value={k}>
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void loadCompile()}>
                Build compile-preview graph
              </Button>
              <Button type="button" variant="outline" onClick={() => setStep(0)}>
                New file
              </Button>
            </div>

            <div className="overflow-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-2">#</th>
                    {columns.slice(0, 6).map((c) => (
                      <th key={c} className="p-2 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                    <th className="p-2">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {rowSlice.map((row, i) => {
                    const skipped = Boolean(
                      (job.row_review_state[String(i)] as { skip?: boolean } | undefined)?.skip
                    );
                    return (
                      <tr key={i} className={cn("border-b", skipped && "opacity-50")}>
                        <td className="p-2 font-mono">{i + 1}</td>
                        {columns.slice(0, 6).map((c) => (
                          <td key={c} className="max-w-[140px] truncate p-2">
                            {String(row[c] ?? "")}
                          </td>
                        ))}
                        <td className="p-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={skipped ? "outline" : "secondary"}
                            onClick={() => void toggleRowSkip(i)}
                          >
                            {skipped ? "Unskip" : "Skip row"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 && compilePreview ? (
        <Card>
          <CardHeader>
            <CardTitle>Compile preview</CardTitle>
            <CardDescription>
              Structural sketch from staged rows (not asserted RDF). Resolve validation messages before
              curating entities manually.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[280px] rounded-md border bg-muted/10">
              <ReactFlowProvider>
                <ReactFlow nodes={flowGraph.nodes} edges={flowGraph.edges} fitView>
                  <Background gap={16} />
                  <Controls />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
            {compilePreview.validation_errors?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-xs text-amber-900 dark:text-amber-200">
                {compilePreview.validation_errors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No compile warnings.</p>
            )}
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back to mapping
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
