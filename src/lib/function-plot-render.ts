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
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Function plot render failed (${response.status})`);
  }
  if (!response.ok) {
    throw new Error(
      (body as { error?: { message?: string } })?.error?.message ??
        `Function plot render failed (${response.status})`,
    );
  }
  return (body as { svg: string }).svg;
}
