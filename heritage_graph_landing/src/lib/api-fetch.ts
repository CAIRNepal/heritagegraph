/** Minimal fetch helpers for public discovery (mirrors main app error shaping). */

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    const raw = await res.text().catch(() => '');
    let message = `Request failed (${res.status})`;
    if (raw && res.headers.get('content-type')?.includes('application/json')) {
      try {
        const o = JSON.parse(raw) as { detail?: string; error?: string; message?: string };
        message =
          (typeof o.error === 'string' && o.error) ||
          (typeof o.message === 'string' && o.message) ||
          (typeof o.detail === 'string' && o.detail) ||
          message;
      } catch {
        /* use default */
      }
    } else if (raw?.trim()) {
      message = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280);
    }
    return new ApiError(res.status, message);
  }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(input, init);
    if (!res.ok) throw await ApiError.fromResponse(res);
    return res;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof TypeError) {
      throw new Error('Unable to reach the server. Check your connection and try again.');
    }
    throw e;
  }
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'The request was cancelled or timed out. Please try again.';
    }
    return error.message || fallback;
  }
  return fallback;
}
