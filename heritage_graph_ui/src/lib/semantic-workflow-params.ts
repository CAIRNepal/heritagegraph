/** Query keys for semantic pattern continuation (URLs only; no server state). */

export const SEMANTIC_WORKFLOW_PATTERN_KEY_PARAM = 'semanticWorkflow';
export const SEMANTIC_WORKFLOW_STEP_ORDER_PARAM = 'semanticStep';
export const SEMANTIC_WORKFLOW_COMPLETED_PARAM = 'completed';

export interface SemanticWorkflowContext {
  readonly patternKey: string;
  readonly stepOrder: number;
}

/** Parse workflow context from contributor step URLs (?semanticWorkflow=&semanticStep=). */
export function parseSemanticWorkflowParams(
  searchParams: URLSearchParams
): SemanticWorkflowContext | null {
  const key = searchParams.get(SEMANTIC_WORKFLOW_PATTERN_KEY_PARAM)?.trim();
  const stepRaw = searchParams.get(SEMANTIC_WORKFLOW_STEP_ORDER_PARAM)?.trim();
  if (!key) return null;
  const stepOrder = Number.parseInt(stepRaw ?? '', 10);
  if (!Number.isFinite(stepOrder) || stepOrder < 1) return null;
  return { patternKey: key, stepOrder };
}

export function parseSemanticWorkflowCompleted(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get(SEMANTIC_WORKFLOW_COMPLETED_PARAM)?.trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/** Return `/contribute/pattern/{key}?completed={step}` for post-submit redirects from workflow steps. */
export function buildPatternCompletionUrl(patternKey: string, stepOrder: number): string {
  const path = `/contribute/pattern/${encodeURIComponent(patternKey)}`;
  const params = new URLSearchParams();
  params.set(SEMANTIC_WORKFLOW_COMPLETED_PARAM, String(stepOrder));
  return `${path}?${params.toString()}`;
}

/** Merge semanticWorkflow / semanticStep into a contribute route (+ optional YAML linkQuery). */
export function appendWorkflowContextToRoute(
  route: string,
  linkQuery: string | undefined,
  ctx: SemanticWorkflowContext
): string {
  const qIdx = route.indexOf('?');
  const path = qIdx >= 0 ? route.slice(0, qIdx) : route;
  const existing = qIdx >= 0 ? route.slice(qIdx + 1) : '';
  const params = new URLSearchParams(existing);
  if (linkQuery?.trim()) {
    const extra = new URLSearchParams(linkQuery.trim());
    extra.forEach((value, paramKey) => {
      params.set(paramKey, value);
    });
  }
  params.set(SEMANTIC_WORKFLOW_PATTERN_KEY_PARAM, ctx.patternKey);
  params.set(SEMANTIC_WORKFLOW_STEP_ORDER_PARAM, String(ctx.stepOrder));
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
