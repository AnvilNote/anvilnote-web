"use client";

import { getApiBaseUrl } from "@/lib/api";
import type { FunctionPlotSpec } from "@/lib/tiptap/function-plot";

export async function renderFunctionPlot(
  spec: FunctionPlotSpec,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/api/funcs/render`, {
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
    const error = body as {
      error?: { message?: string } | string;
    };
    const message =
      typeof error?.error === "string"
        ? error.error
        : error?.error?.message;
    throw new Error(message ?? `Function plot render failed (${response.status})`);
  }

  const pdf = (body as { pdf?: unknown }).pdf;
  if (typeof pdf !== "string" || pdf.length === 0) {
    throw new Error("Function plot renderer returned no PDF");
  }
  return pdf;
}
