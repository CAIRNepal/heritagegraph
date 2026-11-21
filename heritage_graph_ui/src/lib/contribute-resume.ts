/**
 * Encode/decode safe return targets for contribute flows (e.g. KG proposal → full DataSource form → resume).
 */

/** Query keys cleared when resuming or starting a nested contribute round-trip */
export const RESUME_PICK_KEYS = [
  "pickedOntology",
  "pickedId",
  "pickedRole",
  "pickField",
] as const;

/** Encode an app-internal path + optional query for use in `?resume=` */
export function encodeResumeTarget(pathWithQuery: string): string | null {
  const trimmed = pathWithQuery.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  // Rejecting CR/LF/NUL is the purpose of this guard: they enable header
  // injection and path smuggling.
  // eslint-disable-next-line no-control-regex
  if (/[\r\n\u0000]/.test(trimmed)) return null;
  try {
    return encodeURIComponent(trimmed);
  } catch {
    return null;
  }
}

/** Decode `resume` query param; rejects open redirects and malformed input */
export function decodeResumeTarget(encoded: string): string | null {
  try {
    const decoded = decodeURIComponent(encoded.trim());
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
    // eslint-disable-next-line no-control-regex -- see encodeResumeTarget.
    if (/[\r\n\u0000]/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function appendResumePickParams(
  resumePathAndQuery: string,
  opts: {
    pickedOntology: string;
    pickedId: string;
    pickedRole?: "primary" | "supporting";
  }
): string {
  const qMark = resumePathAndQuery.indexOf("?");
  const pathPart =
    qMark >= 0 ? resumePathAndQuery.slice(0, qMark) : resumePathAndQuery;
  const queryPart = qMark >= 0 ? resumePathAndQuery.slice(qMark + 1) : "";
  const params = new URLSearchParams(queryPart);
  params.set("pickedOntology", opts.pickedOntology);
  params.set("pickedId", opts.pickedId);
  if (opts.pickedRole) params.set("pickedRole", opts.pickedRole);
  const q = params.toString();
  return q ? `${pathPart}?${q}` : pathPart;
}

export function stripResumePickKeys(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  for (const k of RESUME_PICK_KEYS) next.delete(k);
  return next;
}

/** Remove resume round-trip keys before encoding the next `resume` target */
export function stripContributeFlowKeys(params: URLSearchParams): URLSearchParams {
  const next = stripResumePickKeys(params);
  next.delete("resume");
  next.delete("pickRole");
  return next;
}
