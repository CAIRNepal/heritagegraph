/**
 * Consistent fetch wrapper and error formatting for Django REST Framework responses.
 */

import { getPublicApiUrl } from "@/lib/api-base";

export class NetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "NetworkError";
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, userMessage: string, body?: unknown) {
    super(userMessage);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** User-facing copy (same as `message`, kept for explicit call sites). */
  get userMessage(): string {
    return this.message;
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    const raw = await res.text().catch(() => "");
    let body: unknown = raw;
    if (raw && (res.headers.get("content-type") || "").includes("application/json")) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
    const userMessage = buildUserMessageFromResponse(res.status, body, raw);
    let adjusted = userMessage;
    if (res.status === 429) {
      const ra = res.headers.get("Retry-After");
      if (ra) {
        const sec = Number.parseInt(ra, 10);
        const suffix = Number.isFinite(sec)
          ? ` Try again in about ${Math.max(1, Math.ceil(sec / 60))} minute(s).`
          : "";
        adjusted = `${adjusted}${suffix}`;
      }
    }
    return new ApiError(res.status, adjusted, body);
  }
}

function humanizeFieldKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Turn DRF / common API error payloads into a short, readable string. */
export function formatErrorBody(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === "string") {
    const t = body.trim();
    if (!t) return null;
    return t.length > 400 ? `${t.slice(0, 400)}…` : t;
  }
  if (typeof body !== "object") return String(body);

  const o = body as Record<string, unknown>;

  if (Array.isArray(o.blockers)) {
    const msgs = o.blockers.filter((x): x is string => typeof x === "string");
    if (msgs.length) return msgs.join(" ");
  }

  if (typeof o.error === "string") return o.error;
  if (typeof o.message === "string") return o.message;
  if (typeof o.detail === "string") return o.detail;
  if (Array.isArray(o.detail)) {
    const parts = o.detail
      .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  if (typeof o.detail === "object" && o.detail !== null && !Array.isArray(o.detail)) {
    const nested = formatErrorBody(o.detail);
    if (nested) return nested;
  }

  if (Array.isArray(o.non_field_errors)) {
    const msgs = o.non_field_errors.filter((x): x is string => typeof x === "string");
    if (msgs.length) return msgs.join(" ");
  }

  const fieldLines: string[] = [];
  for (const [key, val] of Object.entries(o)) {
    if (
      key === "detail" ||
      key === "non_field_errors" ||
      key === "error" ||
      key === "message" ||
      key === "blockers"
    )
      continue;
    if (Array.isArray(val)) {
      const msgs = val
        .map((x) => (typeof x === "string" ? x : typeof x === "object" ? JSON.stringify(x) : String(x)))
        .filter(Boolean);
      if (msgs.length) {
        fieldLines.push(`${humanizeFieldKey(key)}: ${msgs.join(" ")}`);
      }
    } else if (val != null && typeof val === "object") {
      fieldLines.push(`${humanizeFieldKey(key)}: ${JSON.stringify(val)}`);
    } else if (val != null) {
      fieldLines.push(`${humanizeFieldKey(key)}: ${String(val)}`);
    }
  }
  if (fieldLines.length) return fieldLines.slice(0, 6).join(" · ");

  try {
    const s = JSON.stringify(o);
    return s.length > 400 ? `${s.slice(0, 400)}…` : s;
  } catch {
    return "Request could not be completed.";
  }
}

function statusFallbackMessage(status: number): string {
  switch (status) {
    case 400:
      return "The request could not be understood. Please check your input and try again.";
    case 401:
      return "Your session has expired or you are not signed in. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested item could not be found.";
    case 408:
      return "The request took too long. Please try again.";
    case 409:
      return "This action conflicts with the current state. Refresh and try again.";
    case 413:
      return "The upload is too large.";
    case 507:
      return "The server could not reserve storage for this upload (permissions or disk). Try again later or contact support.";
    case 422:
      return "Some fields are invalid. Check the form and try again.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    default:
      if (status >= 500) {
        return "Something went wrong on our side. Please try again in a few minutes.";
      }
      if (status >= 400) {
        return `The request could not be completed (${status}).`;
      }
      return "Something went wrong.";
  }
}

function buildUserMessageFromResponse(status: number, body: unknown, rawText: string): string {
  const parsed = formatErrorBody(body);
  if (parsed) {
    return parsed;
  }
  if (rawText?.trim()) {
    const stripped = rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (stripped) return stripped.length > 280 ? `${stripped.slice(0, 280)}…` : stripped;
  }
  return statusFallbackMessage(status);
}

/** Map any thrown value to a single user-facing string. */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof NetworkError) return error.message;
  if (error instanceof Error) {
    if (error.name === "AbortError") return "The request was cancelled.";
    const m = error.message?.trim();
    if (m && m !== "Failed to fetch") return m;
    return "Unable to reach the server. Check your connection and try again.";
  }
  return fallback;
}

/** Parsed from project transition 400 payloads: `{ blockers: string[] }`. */
export function extractProjectSubmissionBlockers(error: unknown): string[] | null {
  if (error instanceof ApiError && error.body && typeof error.body === "object") {
    const b = error.body as Record<string, unknown>;
    const blockers = b.blockers;
    if (Array.isArray(blockers) && blockers.every((x): x is string => typeof x === "string")) {
      return blockers.filter(Boolean);
    }
  }
  return null;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * `fetch` that throws {@link ApiError} on non-OK HTTP status and {@link NetworkError} when offline / CORS / DNS fails.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(input, init);
    if (!res.ok) {
      throw await ApiError.fromResponse(res);
    }
    return res;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof TypeError || (e instanceof Error && e.name === "NetworkError")) {
      throw new NetworkError(
        "Unable to reach the server. Check your connection and try again.",
        { cause: e }
      );
    }
    throw e;
  }
}

export async function apiFetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await apiFetch(input, init);
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      res.status,
      "The server returned data we could not read. Please try again."
    );
  }
}

/** Build an absolute API URL from a path starting with `/`. */
export function apiUrl(path: string): string {
  const base = getPublicApiUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
