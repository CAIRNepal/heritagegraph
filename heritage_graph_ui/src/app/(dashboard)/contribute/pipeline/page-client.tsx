'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  IconBrain,
  IconSparkles,
  IconFileUpload,
  IconPlayerPlay,
  IconRefresh,
  IconCheck,
  IconX,
  IconLoader2,
  IconClock,
  IconAlertTriangle,
  IconDatabase,
  IconSearch,
  IconShield,
  IconRoute,
  IconFileText,
  IconChevronDown,
  IconChevronUp,
  IconNetwork,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { fadeInUp, staggerContainer, glassCard } from '@/lib/design';
import { apiFetch, apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { buildVersionedOcrBaseUrl } from '@/lib/ingestion-api';

const POLL_INTERVAL_MS = 3000;

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentKey =
  | 'doc_intelligence'
  | 'extraction'
  | 'shacl_validation'
  | 'entity_resolution'
  | 'epistemic_routing';

type AgentStatus = 'pending' | 'running' | 'complete' | 'failed';
type PipelineStatus = 'idle' | 'running' | 'complete' | 'failed';

interface DocIntelResult {
  heritage_doc_type: string;
  heritage_doc_type_confidence: number;
  detected_language: string;
  chunk_count: number;
  ontology_class_keys: string[];
}

interface ExtractionResult {
  candidate_count: number;
  rejected_count: number;
}

interface ShaclResult {
  validated_count: number;
  rejected_count: number;
  rejection_reasons: { subject: string; predicate: string; reason: string; violation_type: string }[];
}

interface EntityResolutionResult {
  resolved_count: number;
  skipped_count: number;
}

interface EpistemicRoutingResult {
  counts: Record<string, number>;
}

interface AgentResults {
  doc_intelligence?: DocIntelResult;
  extraction?: ExtractionResult;
  shacl_validation?: ShaclResult;
  entity_resolution?: EntityResolutionResult;
  epistemic_routing?: EpistemicRoutingResult;
}

interface Assertion {
  subject: string;
  subject_type: string;
  predicate: string;
  object: string;
  object_type: string;
  subject_uri: string;
  object_uri: string | null;
  confidence_score: number;
  route: string;
  kumari_flagged: boolean;
  conflict_detected: boolean;
  db_assertion_id: string | null;
}

interface PipelineMeta {
  pipeline_status?: PipelineStatus;
  pipeline_started_at?: string;
  pipeline_finished_at?: string;
  pipeline_error?: string | null;
  agent_status?: Record<AgentKey, AgentStatus>;
  agent_results?: AgentResults;
  assertions?: Assertion[];
}

interface OcrDocument {
  id: string;
  status: string;
  document_type: string;
  processing_finished: string | null;
  raw_text: string;
  metadata: PipelineMeta | null;
}

interface GraphElement {
  data: {
    id: string;
    label?: string;
    source?: string;
    target?: string;
    cidoc_type?: string;
    nodeType?: string;
    confidence_score?: number;
    route?: string;
    kumari_flagged?: boolean;
  };
}

interface GraphExport {
  document_id: string;
  pipeline_status: string | null;
  elements: GraphElement[];
  node_count: number;
  edge_count: number;
}

// ── Agent step definitions ────────────────────────────────────────────────────

const AGENTS: {
  key: AgentKey;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    key: 'doc_intelligence',
    label: 'Doc Intelligence',
    description: 'Classifies heritage doc type, detects language, chunks text, selects ontology snippets',
    icon: IconFileText,
    color: 'from-sky-500 to-blue-600',
  },
  {
    key: 'extraction',
    label: 'Extraction',
    description: 'Dual-temperature Ollama calls extract CIDOC-CRM triples with agreement scoring',
    icon: IconSearch,
    color: 'from-violet-500 to-purple-600',
  },
  {
    key: 'shacl_validation',
    label: 'SHACL Validation',
    description: 'Validates triples against shapes, auto-corrects inverse predicates, enforces hard rules',
    icon: IconShield,
    color: 'from-amber-500 to-orange-600',
  },
  {
    key: 'entity_resolution',
    label: 'Entity Resolution',
    description: 'Co-reference resolution, transliteration normalisation, Oxigraph SPARQL lookup or URI minting',
    icon: IconDatabase,
    color: 'from-emerald-500 to-teal-600',
  },
  {
    key: 'epistemic_routing',
    label: 'Epistemic Router',
    description: 'Routes assertions by confidence to auto-accept, review queues, or reject. Auto-accepted triples are written to Oxigraph.',
    icon: IconRoute,
    color: 'from-rose-500 to-red-600',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function agentStatusIcon(status: AgentStatus | undefined) {
  if (!status || status === 'pending')
    return <IconClock className="h-4 w-4 text-muted-foreground" />;
  if (status === 'running')
    return <IconLoader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === 'complete')
    return <IconCheck className="h-4 w-4 text-emerald-500" />;
  return <IconX className="h-4 w-4 text-red-500" />;
}

function agentStatusBadge(status: AgentStatus | undefined) {
  if (!status || status === 'pending')
    return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
  if (status === 'running')
    return <Badge className="text-[10px] bg-primary text-primary-foreground animate-pulse">Running</Badge>;
  if (status === 'complete')
    return <Badge className="text-[10px] bg-emerald-500 text-white">Done</Badge>;
  return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
}

const ROUTE_STYLE: Record<string, string> = {
  auto_accept:      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  community_review: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  expert_review:    'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  expert_curator:   'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  conflict:         'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  reject:           'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { data: session } = useSession();
  const [docs, setDocs] = useState<OcrDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<OcrDocument | null>(null);
  const [running, setRunning] = useState(false);
  const [expandedAgents, setExpandedAgents] = useState<Set<AgentKey>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const authHeaders = useCallback((): HeadersInit => {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    const t = (session as unknown as Record<string, unknown>)?.accessToken;
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  }, [session]);

  const ocrBase = useCallback(() => {
    try { return buildVersionedOcrBaseUrl(); }
    catch { return 'http://localhost:8000/api/v1/data'; }
  }, []);

  // Load OCR-completed documents
  const loadDocs = useCallback(async () => {
    if (!session?.accessToken) return;
    setDocsLoading(true);
    try {
      const data = await apiFetchJson<{ results: OcrDocument[] }>(
        `${ocrBase()}/ocr-documents/?status=completed`,
        { headers: authHeaders() },
      );
      setDocs(data.results ?? []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not load documents.'));
    } finally {
      setDocsLoading(false);
    }
  }, [session, authHeaders, ocrBase]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // Poll the selected document for pipeline progress
  const pollDoc = useCallback(async (docId: string) => {
    try {
      const doc = await apiFetchJson<OcrDocument>(
        `${ocrBase()}/ocr-documents/${docId}/`,
        { headers: authHeaders() },
      );
      setSelectedDoc(doc);
      const ps = doc.metadata?.pipeline_status;
      if (ps === 'complete' || ps === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setRunning(false);
        if (ps === 'complete') toast.success('Pipeline completed — assertions written to database and Oxigraph.');
        else toast.error(`Pipeline failed: ${doc.metadata?.pipeline_error ?? 'unknown error'}`);
      }
    } catch {
      // keep polling on transient errors
    }
  }, [authHeaders, ocrBase]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const selectDoc = useCallback((doc: OcrDocument) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setSelectedDoc(doc);
    setRunning(false);
  }, []);

  const runPipeline = async () => {
    if (!selectedDoc) return;
    setRunning(true);
    try {
      await apiFetch(
        `${ocrBase()}/ocr-documents/${selectedDoc.id}/run-pipeline/`,
        { method: 'POST', headers: authHeaders() },
      );
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => pollDoc(selectedDoc.id), POLL_INTERVAL_MS);
      await pollDoc(selectedDoc.id);
    } catch (e) {
      setRunning(false);
      toast.error(getApiErrorMessage(e, 'Could not start pipeline.'));
    }
  };

  const meta = selectedDoc?.metadata ?? null;
  const pipelineStatus: PipelineStatus = meta?.pipeline_status ?? 'idle';
  const agentStatuses = meta?.agent_status ?? ({} as Record<AgentKey, AgentStatus>);
  const agentResults = meta?.agent_results ?? {};
  const assertions = meta?.assertions ?? [];
  const routingCounts = (agentResults.epistemic_routing?.counts ?? {}) as Record<string, number>;

  const toggleAgent = (key: AgentKey) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <motion.div
        initial="hidden" animate="show" variants={staggerContainer}
        className={`relative overflow-hidden ${glassCard} p-8`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-xl" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <motion.div variants={fadeInUp} className="relative z-10 space-y-2">
          <p className="text-sm text-white/70">Contribute / AI Pipeline</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
            <IconSparkles className="w-4 h-4" /> KG Ingestion Pipeline
          </div>
          <h1 className="text-3xl font-black text-white">
            5-Agent <span className="text-white/90">AI Pipeline</span>
          </h1>
          <p className="text-white/90 max-w-2xl">
            Runs an OCR-extracted document through Doc Intelligence → Extraction → SHACL Validation →
            Entity Resolution → Epistemic Router. Auto-accepted triples are written to the Django database
            and Oxigraph knowledge graph.
          </p>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Document selector ── */}
        <motion.div initial="hidden" animate="show" variants={fadeInUp}>
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <IconFileUpload className="h-4 w-4 text-primary" />
                Select Document
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {docsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                  <IconLoader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : docs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No OCR-completed documents found.<br />
                  Upload a document via the contribute flow first.
                </p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                  {docs.map(doc => {
                    const isSelected = selectedDoc?.id === doc.id;
                    const docPipelineStatus = doc.metadata?.pipeline_status;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => selectDoc(doc)}
                        className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-all border ${
                          isSelected
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-transparent hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] text-muted-foreground truncate">{doc.id.slice(0, 16)}…</p>
                            <p className="text-xs font-medium truncate">{doc.document_type.replace(/_/g, ' ')}</p>
                          </div>
                          {docPipelineStatus && (
                            <Badge
                              variant="secondary"
                              className={`text-[9px] shrink-0 ${
                                docPipelineStatus === 'complete'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : docPipelineStatus === 'running'
                                  ? 'bg-primary/10 text-primary animate-pulse'
                                  : docPipelineStatus === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : ''
                              }`}
                            >
                              {docPipelineStatus}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <Button
                variant="outline" size="sm"
                className="w-full mt-2 border-primary/40 text-primary"
                onClick={loadDocs}
                disabled={docsLoading}
              >
                <IconRefresh className={`h-3.5 w-3.5 mr-1.5 ${docsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Pipeline panel ── */}
        <motion.div initial="hidden" animate="show" variants={fadeInUp} className="lg:col-span-2 space-y-4">
          {/* Run controls */}
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-0.5">
                  {selectedDoc ? (
                    <>
                      <p className="text-sm font-medium">
                        Document:{' '}
                        <span className="font-mono text-[11px] text-muted-foreground">{selectedDoc.id.slice(0, 24)}…</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Type: {selectedDoc.document_type.replace(/_/g, ' ')} ·{' '}
                        {selectedDoc.raw_text ? `${selectedDoc.raw_text.length.toLocaleString()} chars` : 'No text'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a document to run the pipeline.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {pipelineStatus === 'running' ? (
                    <Button disabled>
                      <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> Running…
                    </Button>
                  ) : (
                    <Button
                      onClick={runPipeline}
                      disabled={!selectedDoc || running}
                    >
                      <IconPlayerPlay className="h-4 w-4 mr-2" />
                      {pipelineStatus === 'complete' ? 'Re-run Pipeline' : 'Run Pipeline'}
                    </Button>
                  )}
                </div>
              </div>
              {pipelineStatus === 'failed' && meta?.pipeline_error && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  {meta.pipeline_error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5-step agent progress */}
          <div className="space-y-2">
            {AGENTS.map((agent, idx) => {
              const status = agentStatuses[agent.key];
              const result = agentResults[agent.key as keyof AgentResults];
              const isExpanded = expandedAgents.has(agent.key);
              return (
                <motion.div
                  key={agent.key}
                  initial="hidden" animate="show" variants={fadeInUp}
                  className={`rounded-xl border transition-all ${
                    status === 'running'
                      ? 'border-primary/40 shadow-sm'
                      : status === 'complete'
                      ? 'border-emerald-200 dark:border-emerald-900'
                      : status === 'failed'
                      ? 'border-red-200 dark:border-red-900'
                      : 'border-border'
                  } bg-card`}
                >
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    onClick={() => result && toggleAgent(agent.key)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{agent.label}</span>
                        {agentStatusBadge(status)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {agentStatusIcon(status)}
                      {result && (
                        isExpanded
                          ? <IconChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                  {isExpanded && result && (
                    <div className="px-4 pb-4 pt-0 border-t border-border">
                      <AgentResultPanel agentKey={agent.key} result={result} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ── Results tabs (only after pipeline ran) ── */}
      {pipelineStatus === 'complete' && (
        <motion.div initial="hidden" animate="show" variants={fadeInUp}>
          <Tabs defaultValue="assertions">
            <TabsList className="h-auto p-1 gap-1 bg-muted border border-border rounded-xl">
              <TabsTrigger value="assertions" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
                <IconDatabase className="h-4 w-4" />
                Assertions
                <Badge variant="secondary" className="ml-1 text-xs">{assertions.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="graph" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
                <IconNetwork className="h-4 w-4" />
                Graph Preview
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
                <IconBrain className="h-4 w-4" />
                Routing Summary
              </TabsTrigger>
            </TabsList>

            {/* Assertions table */}
            <TabsContent value="assertions" className="mt-4">
              <div className={glassCard}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 border-border">
                        <TableHead className="text-muted-foreground w-36">Route</TableHead>
                        <TableHead className="text-muted-foreground">Subject</TableHead>
                        <TableHead className="text-muted-foreground">Predicate</TableHead>
                        <TableHead className="text-muted-foreground">Object</TableHead>
                        <TableHead className="text-muted-foreground w-20 text-center">Conf.</TableHead>
                        <TableHead className="text-muted-foreground w-16 text-center">Flags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assertions.map((a, i) => (
                        <TableRow
                          key={i}
                          className="border-border hover:bg-accent/40"
                        >
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] ${ROUTE_STYLE[a.route] ?? ''}`}>
                              {a.route.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium truncate max-w-[180px]">{a.subject}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">{a.subject_uri}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs font-mono truncate max-w-[160px] text-muted-foreground">{a.predicate}</p>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm truncate max-w-[180px]">{a.object}</p>
                              {a.object_uri && (
                                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">{a.object_uri}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <ConfidenceBar score={a.confidence_score} />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {a.kumari_flagged && (
                                <Badge variant="outline" className="text-[9px] px-1 border-orange-400 text-orange-600">K</Badge>
                              )}
                              {a.conflict_detected && (
                                <Badge variant="outline" className="text-[9px] px-1 border-amber-400 text-amber-600">C</Badge>
                              )}
                              {!a.kumari_flagged && !a.conflict_detected && (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Cytoscape graph preview */}
            <TabsContent value="graph" className="mt-4">
              {selectedDoc && (
                <GraphPreview
                  docId={selectedDoc.id}
                  authHeaders={authHeaders()}
                  ocrBase={ocrBase()}
                />
              )}
            </TabsContent>

            {/* Routing summary */}
            <TabsContent value="summary" className="mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { key: 'auto_accept',      label: 'Auto-accepted',   colorClass: 'text-emerald-600 dark:text-emerald-400' },
                  { key: 'community_review', label: 'Community review', colorClass: 'text-sky-600 dark:text-sky-400' },
                  { key: 'expert_review',    label: 'Expert review',   colorClass: 'text-violet-600 dark:text-violet-400' },
                  { key: 'expert_curator',   label: 'Expert curator',  colorClass: 'text-orange-600 dark:text-orange-400' },
                  { key: 'conflict',         label: 'Conflict',        colorClass: 'text-amber-600 dark:text-amber-400' },
                  { key: 'reject',           label: 'Rejected',        colorClass: 'text-red-600 dark:text-red-400' },
                ].map(({ key, label, colorClass }) => (
                  <Card key={key} className="border-muted">
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className={`text-2xl font-black ${colorClass}`}>
                        {routingCounts[key] ?? 0}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {routingCounts['auto_accept'] > 0 && (
                <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <IconCheck className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{routingCounts['auto_accept']}</strong> triple{routingCounts['auto_accept'] !== 1 ? 's' : ''} were
                    auto-accepted and written to both the <strong>Django HeritageAssertion</strong> table and
                    the <strong>Oxigraph</strong> knowledge graph.
                  </span>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </div>
  );
}

// ── GraphPreview — loads graph-export and renders with Cytoscape ──────────────

const ROUTE_COLORS: Record<string, string> = {
  auto_accept:      '#10b981',
  community_review: '#0ea5e9',
  expert_review:    '#8b5cf6',
  expert_curator:   '#f97316',
  conflict:         '#f59e0b',
  reject:           '#ef4444',
};

function GraphPreview({
  docId,
  authHeaders,
  ocrBase,
}: {
  docId: string;
  authHeaders: HeadersInit;
  ocrBase: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ nodes: number; edges: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetchJson<GraphExport>(
          `${ocrBase}/ocr-documents/${docId}/graph-export/`,
          { headers: authHeaders },
        );

        if (cancelled) return;
        if (!data.elements.length) {
          setStats({ nodes: 0, edges: 0 });
          setLoading(false);
          return;
        }

        setStats({ nodes: data.node_count, edges: data.edge_count });

        const [cyMod] = await Promise.all([import('cytoscape')]);
        if (cancelled) return;

        const cytoscape = cyMod.default;
        if (cyRef.current) (cyRef.current as { destroy: () => void }).destroy();

        const cy = cytoscape({
          container: containerRef.current!,
          elements: data.elements,
          style: [
            {
              selector: 'node',
              style: {
                label: 'data(label)',
                'font-size': '10px',
                'text-valign': 'bottom',
                'text-margin-y': 4,
                'background-color': '#8b5cf6',
                color: '#374151',
                width: 28,
                height: 28,
                'text-max-width': '100px',
                'text-wrap': 'ellipsis',
              },
            },
            {
              selector: 'edge',
              style: {
                label: 'data(label)',
                'font-size': '8px',
                color: '#6b7280',
                'text-rotation': 'autorotate',
                'curve-style': 'bezier',
                'target-arrow-shape': 'triangle',
                'target-arrow-color': (ele: { data: (key: string) => string }) =>
                  ROUTE_COLORS[ele.data('route')] ?? '#6b7280',
                'line-color': (ele: { data: (key: string) => string }) =>
                  ROUTE_COLORS[ele.data('route')] ?? '#6b7280',
                width: 1.5,
                opacity: 0.8,
              } as Record<string, unknown>,
            },
          ],
          layout: { name: 'cose', animate: false, randomize: false },
          minZoom: 0.2,
          maxZoom: 4,
          wheelSensitivity: 0.3,
        });

        cyRef.current = cy;
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(getApiErrorMessage(e, 'Could not load graph data.'));
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      if (cyRef.current) (cyRef.current as { destroy: () => void }).destroy();
    };
  }, [docId, authHeaders, ocrBase]);

  return (
    <div className={`${glassCard} overflow-hidden`}>
      {stats && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border text-xs text-muted-foreground">
          <span>{stats.nodes} nodes</span>
          <span>·</span>
          <span>{stats.edges} edges</span>
          <span>·</span>
          <span className="flex items-center gap-3">
            {Object.entries(ROUTE_COLORS).map(([route, color]) => (
              <span key={route} className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
                {route.replace(/_/g, ' ')}
              </span>
            ))}
          </span>
        </div>
      )}
      <div className="relative" style={{ height: 480 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {!loading && !error && stats?.nodes === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No non-rejected assertions to display.
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  const p = Math.round(score * 100);
  const color =
    p >= 90 ? 'bg-emerald-500' : p >= 70 ? 'bg-sky-500' : p >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs font-medium">{p}%</span>
      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function AgentResultPanel({
  agentKey,
  result,
}: {
  agentKey: AgentKey;
  result: AgentResults[keyof AgentResults];
}) {
  if (agentKey === 'doc_intelligence') {
    const r = result as DocIntelResult;
    return (
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <Stat label="Doc type" value={r.heritage_doc_type.replace(/_/g, ' ')} />
        <Stat label="Confidence" value={pct(r.heritage_doc_type_confidence)} />
        <Stat label="Language" value={r.detected_language} />
        <Stat label="Chunks" value={String(r.chunk_count)} />
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground mb-1">Ontology classes</p>
          <div className="flex flex-wrap gap-1">
            {r.ontology_class_keys.map(k => (
              <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (agentKey === 'extraction') {
    const r = result as ExtractionResult;
    return (
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Candidates extracted" value={String(r.candidate_count)} highlight />
        <Stat label="Parse failures" value={String(r.rejected_count)} />
      </div>
    );
  }

  if (agentKey === 'shacl_validation') {
    const r = result as ShaclResult;
    return (
      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Validated" value={String(r.validated_count)} highlight />
          <Stat label="Rejected" value={String(r.rejected_count)} />
        </div>
        {r.rejection_reasons.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Top rejections</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {r.rejection_reasons.map((rr, i) => (
                <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-muted/60 px-2 py-1">
                  <Badge variant="outline" className="text-[9px] shrink-0">{rr.violation_type}</Badge>
                  <span className="truncate text-muted-foreground">{rr.subject} · {rr.predicate}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (agentKey === 'entity_resolution') {
    const r = result as EntityResolutionResult;
    return (
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Resolved" value={String(r.resolved_count)} highlight />
        <Stat label="Skipped" value={String(r.skipped_count)} />
      </div>
    );
  }

  if (agentKey === 'epistemic_routing') {
    const r = result as EpistemicRoutingResult;
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(r.counts).map(([route, count]) => (
          <div
            key={route}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${ROUTE_STYLE[route] ?? 'bg-muted'}`}
          >
            <span>{count}</span>
            <span className="opacity-70">{route.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-primary' : ''}`}>
        {value}
      </p>
    </div>
  );
}
