"use client";

import { getApiBaseUrl } from "@/lib/api";
import type { StatsChartSpec } from "@/lib/tiptap/stats-chart";

export async function renderStatsChart(
  spec: StatsChartSpec,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/api/charts/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Same "kind" requirement as function-plot-render.ts — the API's
    // discriminated union routes on this field read directly off the raw
    // request body, so it must always be sent explicitly.
    body: JSON.stringify({ ...spec, kind: "statsChart" }),
    signal,
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Stats chart render failed (${response.status})`);
  }
  if (!response.ok) {
    throw new Error(
      (body as { error?: { message?: string } })?.error?.message ??
        `Stats chart render failed (${response.status})`,
    );
  }
  return (body as { svg: string }).svg;
}
