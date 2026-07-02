"use client";

import { buildExportFileName } from "@/lib/export-filename";
import { deliverFile, type DeliverResult } from "@/lib/export-target";

// Delivers a rendered PDF: writes it into "<chosen folder>/AnvilNote/" via the
// File System Access API when a target is set, otherwise downloads it. The file
// is named "<title>-<yyyymmddHHMMSS>.pdf" either way.
//
// Returns where it went so callers can show an accurate toast.
export type { DeliverResult };

export async function deliverPdf(
  pdfHref: string,
  title: string,
  subfolder?: string,
): Promise<DeliverResult> {
  const response = await fetch(pdfHref);
  const blob = await response.blob();
  const fileName = buildExportFileName(title);
  return deliverFile(blob, fileName, subfolder);
}
