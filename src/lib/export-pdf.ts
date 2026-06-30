"use client";

import { buildExportFileName } from "@/lib/export-filename";
import { writePdfToTarget } from "@/lib/export-target";

// Delivers a rendered PDF: writes it into "<chosen folder>/AnvilNote/" via the
// File System Access API when a target is set, otherwise downloads it. The file
// is named "<title>-<yyyymmddHHMMSS>.pdf" either way.
//
// Returns where it went so callers can show an accurate toast.
export type DeliverResult =
  | { kind: "folder"; fileName: string; path: string }
  | { kind: "download"; fileName: string };

export async function deliverPdf(
  pdfHref: string,
  title: string,
): Promise<DeliverResult> {
  const response = await fetch(pdfHref);
  const blob = await response.blob();
  const fileName = buildExportFileName(title);

  // Called from a click handler, so permission prompts are allowed.
  const written = await writePdfToTarget(blob, fileName, true);
  if (written.ok) {
    return { kind: "folder", fileName, path: written.path };
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { kind: "download", fileName };
}
