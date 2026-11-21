import { fetchOcrStatus, type OcrDocumentStatus } from "@/hooks/use-heritage-ocr-suggestions";

/** Poll OCR status with backoff; stops when completed/failed or max duration. */
export async function pollOcrStatusWithBackoff(args: {
  uploadedDocumentId: string;
  accessToken: string;
  onStatus?: (s: OcrDocumentStatus) => void;
  maxMs?: number;
}): Promise<OcrDocumentStatus> {
  const maxMs = args.maxMs ?? 180_000;
  const started = Date.now();
  let delayMs = 2000;

  while (Date.now() - started < maxMs) {
    const st = await fetchOcrStatus({
      uploadedDocumentId: args.uploadedDocumentId,
      accessToken: args.accessToken,
    });
    args.onStatus?.(st);
    if (st.status === "completed" || st.status === "failed") {
      return st;
    }
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs + 1000, 5000);
  }

  return fetchOcrStatus({
    uploadedDocumentId: args.uploadedDocumentId,
    accessToken: args.accessToken,
  });
}
