"use client";

import { getApiBaseUrl } from "@/lib/api";
import type { ChartRequestBody } from "./chart-spec";

export type ChartRenderResult =
  | { format: "plotly-json"; plotly: unknown }
  | { format: "png" | "svg" | "jpg" | "pdf"; dataBase64: string };

export async function renderChart(body: ChartRequestBody, signal?: AbortSignal): Promise<ChartRenderResult> {
  const response = await fetch(`${getApiBaseUrl()}/api/charts/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(`Chart render failed (${response.status})`);
  }
  if (!response.ok) {
    throw new Error(
      (parsed as { error?: { message?: string } })?.error?.message ?? `Chart render failed (${response.status})`,
    );
  }
  return parsed as ChartRenderResult;
}
