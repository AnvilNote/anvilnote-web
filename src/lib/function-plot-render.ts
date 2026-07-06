"use client";

import { getApiBaseUrl } from "@/lib/api";
import type { FunctionPlotSpec } from "@/lib/tiptap/function-plot";

export async function renderFunctionPlot(
  spec: FunctionPlotSpec,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/api/charts/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
    signal,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Function plot render failed (${response.status})`);
  }
  return body.svg as string;
}
