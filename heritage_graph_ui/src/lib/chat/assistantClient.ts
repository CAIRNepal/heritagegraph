import { apiUrl, apiFetchJson } from "@/lib/api-client";

const CHAT_PATH = "/api/v1/assistant/chat/";

export const CHAT_MAX_USER_CHARS = 4000;
const DEFAULT_TIMEOUT_MS = 60_000;

export type ApiChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type SourceAttribution = {
  id: string;
  type: string;
  title: string;
  excerpt?: string;
};

export type ChatCompletionResponse = {
  message: { role: "assistant"; content: string };
  nav?: string;
  sources?: SourceAttribution[];
};

type PostArgs = {
  messages: ApiChatMessage[];
  accessToken?: string | null;
  /** When omitted, a timeout abort is applied. */
  signal?: AbortSignal;
  timeoutMs?: number;
};

export async function postAssistantChat({
  messages,
  accessToken,
  signal: outerSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: PostArgs): Promise<ChatCompletionResponse> {
  const url = apiUrl(CHAT_PATH);
  const inner = new AbortController();
  const t = setTimeout(() => inner.abort(), timeoutMs);

  const onOuterAbort = () => inner.abort();
  if (outerSignal) {
    if (outerSignal.aborted) {
      clearTimeout(t);
      const err = new Error("The request was cancelled.");
      err.name = "AbortError";
      throw err;
    }
    outerSignal.addEventListener("abort", onOuterAbort);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    return await apiFetchJson<ChatCompletionResponse>(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages }),
      signal: inner.signal,
    });
  } finally {
    clearTimeout(t);
    outerSignal?.removeEventListener("abort", onOuterAbort);
  }
}
