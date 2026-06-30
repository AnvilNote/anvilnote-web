"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Document, Page, pdfjs } from "react-pdf";
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// PDF.js worker. The `import.meta.url` form lets the bundler (Turbopack) emit
// the worker as a static asset and resolve its URL — no manual /public copy.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.15;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(value * 100) / 100));
}

export function TemplatePdfViewer({
  pdfUrl,
  templateId,
  templateName,
}: {
  pdfUrl: string;
  templateId: string;
  templateName: string;
}) {
  const t = useTranslations("pdfPreview");

  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [baseWidth, setBaseWidth] = useState(560);

  // Fit pages to the available width at scale 1; zoom multiplies from there.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setBaseWidth(Math.min(820, Math.max(280, width - 32)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Page navigation is by scrolling. Track which page is most in view so the
  // indicator stays accurate.
  const handleScroll = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const mid = root.scrollTop + root.clientHeight / 2;
    let nearest = 1;
    pageRefs.current.forEach((el, i) => {
      if (el && el.offsetTop <= mid) nearest = i + 1;
    });
    setCurrentPage(nearest);
  }, []);

  const zoomIn = useCallback(() => setScale((s) => clampScale(s + SCALE_STEP)), []);
  const zoomOut = useCallback(() => setScale((s) => clampScale(s - SCALE_STEP)), []);
  const resetZoom = useCallback(() => setScale(1), []);

  const downloadPdf = useCallback(async () => {
    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateId}-preview.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
    }
  }, [pdfUrl, templateId]);

  const openPdfInNewTab = useCallback(() => {
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  }, [pdfUrl]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Scrollable page area — all pages stacked vertically. */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative flex min-h-0 flex-1 flex-col items-center gap-4 overflow-auto rounded-lg border bg-muted/30 p-4"
      >
        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{t("failedToLoadPreview")}</p>
            <p className="text-xs text-muted-foreground">{t("previewFileMissing")}</p>
          </div>
        ) : (
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              setIsLoading(false);
              setError(null);
              pageRefs.current = new Array(n).fill(null);
            }}
            onLoadError={(err) => {
              console.error("Template PDF failed to load:", pdfUrl, err);
              setIsLoading(false);
              setError("load-error");
            }}
            loading={
              <div className="flex items-center gap-2 px-6 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("loadingPreview")}
              </div>
            }
            error={
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <FileText className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">{t("failedToLoadPreview")}</p>
              </div>
            }
            className="flex flex-col items-center gap-4"
          >
            {Array.from({ length: numPages ?? 0 }, (_, i) => (
              <div
                key={i}
                ref={(el) => {
                  pageRefs.current[i] = el;
                }}
              >
                <Page
                  pageNumber={i + 1}
                  width={baseWidth * scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  canvasBackground="white"
                  className={cn(
                    "overflow-hidden rounded-sm border bg-white shadow-md",
                    "[&_canvas]:!h-auto",
                  )}
                  aria-label={`${templateName} — ${t("page")} ${i + 1}`}
                  loading={
                    <div className="flex items-center gap-2 px-6 py-12 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      {t("loadingPreview")}
                    </div>
                  }
                />
              </div>
            ))}
          </Document>
        )}
      </div>

      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm tabular-nums text-muted-foreground">
          {t("pageIndicator", { current: currentPage, total: numPages ?? "–" })}
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("zoomOut")}
            disabled={scale <= MIN_SCALE || isLoading || !!error}
            onClick={zoomOut}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("zoomIn")}
            disabled={scale >= MAX_SCALE || isLoading || !!error}
            onClick={zoomIn}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("resetZoom")}
            disabled={scale === 1 || isLoading || !!error}
            onClick={resetZoom}
          >
            <RotateCcw className="size-4" />
          </Button>

          <div className="mx-1 h-5 w-px bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("downloadPdf")}
            onClick={() => void downloadPdf()}
          >
            <Download className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("openPdf")}
            onClick={openPdfInNewTab}
          >
            <ExternalLink className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
