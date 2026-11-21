import { getApiBaseUrl } from "@/lib/config";
import { apiFetch } from "@/lib/api-fetch";

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
  signal?: AbortSignal;
  timeoutMs?: number;
};

function chatUrl(): string {
  const b = getApiBaseUrl();
  return `${b}${CHAT_PATH}`;
}

export async function postAssistantChat({
  messages,
  accessToken: _accessToken,
  signal: outerSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: PostArgs): Promise<ChatCompletionResponse> {
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
  if (_accessToken) {
    headers.Authorization = `Bearer ${_accessToken}`;
  }

  try {
    const res = await apiFetch(chatUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify({ messages }),
      signal: inner.signal,
    });
    const text = await res.text();
    if (!text) return {} as ChatCompletionResponse;
    return JSON.parse(text) as ChatCompletionResponse;
  } finally {
    clearTimeout(t);
    outerSignal?.removeEventListener("abort", onOuterAbort);
  }
}
