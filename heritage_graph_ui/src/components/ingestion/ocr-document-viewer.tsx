"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ReviewPagePayload } from "@/lib/ingestion-api";
import { cn } from "@/lib/utils";

interface OcrDocumentViewerProps {
  blobUrl: string | null;
  fileLabel: string;
  /** MIME hint from upload `File.type` */
  mimeHint: string;
  page: ReviewPagePayload | null;
  pageIndex: number;
  selectedBlockIndex: number | null;
  onSelectBlock: (index: number | null) => void;
  className?: string;
}

function guessIsPdf(mimeHint: string, fileLabel: string): boolean {
  if (mimeHint === "application/pdf") return true;
  return fileLabel.toLowerCase().endsWith(".pdf");
}

function mapBboxToDisplay(
  bbox: [number, number, number, number],
  baseW: number,
  baseH: number,
  dispW: number,
  dispH: number
): { x: number; y: number; width: number; height: number } {
  const [x1, y1, x2, y2] = bbox;
  const bw = baseW > 0 ? baseW : dispW;
  const bh = baseH > 0 ? baseH : dispH;
  const sx = dispW / bw;
  const sy = dispH / bh;
  return {
    x: x1 * sx,
    y: y1 * sy,
    width: Math.max(0, (x2 - x1) * sx),
    height: Math.max(0, (y2 - y1) * sy),
  };
}

export function OcrDocumentViewer({
  blobUrl,
  fileLabel,
  mimeHint,
  page,
  pageIndex,
  selectedBlockIndex,
  onSelectBlock,
  className,
}: OcrDocumentViewerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const isPdf = useMemo(() => guessIsPdf(mimeHint, fileLabel), [mimeHint, fileLabel]);

  const [displaySize, setDisplaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [pdfError, setPdfError] = useState<string | null>(null);

  const baseW = page?.image_width ?? displaySize.w;
  const baseH = page?.image_height ?? displaySize.h;

  const syncImgSize = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w > 0 && h > 0) setDisplaySize({ w, h });
  }, []);

  useEffect(() => {
    if (!blobUrl || !isPdf) return;

    let cancelled = false;
    setPdfError(null);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjs.getDocument({ url: blobUrl }).promise;
        const humanPage = Math.min(Math.max(pageIndex + 1, 1), pdf.numPages);
        const pdfPage = await pdf.getPage(humanPage);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const maxW = 720;
        const scale = Math.min(1.8, maxW / baseViewport.width);
        const viewport = pdfPage.getViewport({ scale });

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;

        setDisplaySize({ w: viewport.width, h: viewport.height });
      } catch (e: unknown) {
        if (!cancelled) {
          setPdfError(e instanceof Error ? e.message : "Could not render PDF.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blobUrl, isPdf, pageIndex]);

  if (!blobUrl) {
    return (
      <div
        className={cn(
          "flex min-h-[240px] items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground",
          className
        )}
      >
        Document preview loads after upload completes.
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={wrapRef}
        className="relative inline-block max-w-full overflow-auto rounded-lg border bg-muted/20"
      >
        {isPdf ? (
          pdfError ? (
            <p className="p-4 text-sm text-destructive">{pdfError}</p>
          ) : (
            <canvas ref={canvasRef} className="block max-w-full h-auto" />
          )
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- blob URL from authenticated fetch
          <img
            ref={imgRef}
            src={blobUrl}
            alt="Source document"
            className="max-h-[min(70vh,520px)] w-auto max-w-full object-contain"
            onLoad={syncImgSize}
          />
        )}

        {displaySize.w > 0 && displaySize.h > 0 && page && page.blocks?.length ? (
          <svg
            className="pointer-events-none absolute left-0 top-0"
            width={displaySize.w}
            height={displaySize.h}
            viewBox={`0 0 ${displaySize.w} ${displaySize.h}`}
          >
            <g className="pointer-events-auto">
              {page.blocks.map((b, i) => {
                const rect =
                  baseW && baseH
                    ? mapBboxToDisplay(b.bbox, baseW, baseH, displaySize.w, displaySize.h)
                    : null;
                if (!rect || rect.width <= 0 || rect.height <= 0) return null;
                const low = b.confidence < 0.42;
                const active = selectedBlockIndex === i;
                return (
                  <rect
                    key={`${i}-${b.text.slice(0, 12)}`}
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill={active ? "hsl(var(--primary) / 0.15)" : "transparent"}
                    stroke={
                      low
                        ? "hsl(var(--destructive) / 0.85)"
                        : active
                          ? "hsl(var(--primary))"
                          : "hsl(var(--foreground) / 0.35)"
                    }
                    strokeWidth={active ? 2 : 1}
                    className="cursor-pointer"
                    onClick={() => onSelectBlock(active ? null : i)}
                  />
                );
              })}
            </g>
          </svg>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Click highlighted regions to inspect OCR lines. Low-confidence boxes use a stronger outline.
      </p>
    </div>
  );
}
