"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Config, Data, Icon, Layout } from "plotly.js-dist-min";

// plotly.js touches `window`/canvas at import time, so it can never run
// during SSR — dynamic-imported with ssr:false the same way any
// canvas/DOM-dependent library must be in a Next.js app.
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// Same CDN URL/config anvilnote-charts's render.py points kaleido at for
// static export — title/xaxis_title/yaxis_title accept LaTeX via Plotly's
// own $...$ syntax once MathJax is on the page, and using the identical
// URL keeps the live preview and the exported PNG/PDF typeset the same
// formula the same way. Plotly only checks window.MathJax at draw time,
// not reactively, so a chart whose very first paint lands before this
// script finishes loading can show raw "$...$" text briefly — self-
// corrects on the next redraw, which the debounced preview triggers on
// almost every settings change anyway.
const MATHJAX_URL = "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js?config=TeX-AMS-MML_SVG";

function ensureMathJaxLoaded() {
  if (document.querySelector(`script[src="${MATHJAX_URL}"]`)) return;
  const script = document.createElement("script");
  script.src = MATHJAX_URL;
  document.head.appendChild(script);
}

type ImageExportApi = {
  icon: Icon;
  downloadImage: (
    gd: unknown,
    opts: { format: "png"; width: number | null; height: number | null; filename: string },
  ) => Promise<string>;
};

// Loaded once (module-level, not per-component-instance) and reused —
// dynamic import so the full plotly.js runtime this needs (Icons,
// downloadImage) only ever loads client-side, same reasoning as the Plot
// component itself above.
let imageExportApiPromise: Promise<ImageExportApi> | null = null;
function loadImageExportApi(): Promise<ImageExportApi> {
  imageExportApiPromise ??= import("plotly.js-dist-min").then((mod) => ({
    icon: mod.Icons.camera,
    downloadImage: mod.downloadImage as ImageExportApi["downloadImage"],
  }));
  return imageExportApiPromise;
}

export type PlotlyFigure = { data: Data[]; layout?: Partial<Layout> };

export function ChartPlotlyView({ figure }: { figure: PlotlyFigure }) {
  const t = useTranslations("editor.chart");
  const [imageExportApi, setImageExportApi] = useState<ImageExportApi | null>(null);

  useEffect(() => {
    ensureMathJaxLoaded();
    loadImageExportApi().then(setImageExportApi);
  }, []);

  // Extra top clearance when the figure carries annotations — currently
  // the only source of those is render.py's y-label-position="top"
  // override (_apply_label_positions), which draws the y-axis title as a
  // paper-anchored annotation sitting right above the plot area. The base
  // 40px title margin below was sized for a plain title with nothing else
  // above the plot, so it collides with that annotation without this.
  const hasTopAnnotation = (figure.layout?.annotations?.length ?? 0) > 0;
  const baseTop = figure.layout?.title ? 40 : 16;

  // Plotly's own built-in "toImage" modebar button reports progress via a
  // plain DOM-injected banner ("Taking snapshot..."/"Snapshot succeeded") —
  // hardcoded English, no i18n hook, and no relation to the app's own toast
  // system (sonner). Swapped out for a same-icon custom button that calls
  // the identical export function itself but routes feedback through
  // toast, matching every other async action's feedback in this app. Only
  // wired once the dynamic plotly.js-dist-min import resolves; the default
  // button stays in place until then rather than briefly disappearing.
  const config: Partial<Config> = imageExportApi
    ? {
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: ["toImage"],
        modeBarButtonsToAdd: [
          {
            name: "toImage",
            title: t("downloadImage"),
            icon: imageExportApi.icon,
            click: (gd) => {
              const toastId = toast.loading(t("snapshotTaking"));
              imageExportApi
                .downloadImage(gd, { format: "png", width: null, height: null, filename: "newplot" })
                .then(() => toast.success(t("snapshotSucceeded"), { id: toastId }))
                .catch(() => toast.error(t("snapshotFailed"), { id: toastId }));
            },
          },
        ],
      }
    : { displaylogo: false, responsive: true };

  return (
    <Plot
      config={config}
      data={figure.data}
      layout={{ ...figure.layout, autosize: true, margin: { t: baseTop + (hasTopAnnotation ? 20 : 0) } }}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
