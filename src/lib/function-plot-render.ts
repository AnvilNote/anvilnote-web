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
    // "kind" tags which member of the API's discriminated request-body
    // union this is — it's a wire-protocol detail, not part of the node's
    // own persisted content, so it's added here rather than stored on
    // FunctionPlotSpec/the Tiptap node itself. Required, not optional:
    // the API's z.discriminatedUnion routes on this field by reading it
    // directly off the raw request body — a request missing it entirely
    // fails with "No matching discriminator" regardless of any per-branch
    // schema default.
    body: JSON.stringify({ ...spec, kind: "functionPlot" }),
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
