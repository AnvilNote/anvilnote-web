"use client";

import { getApiBaseUrl } from "@/lib/api";
import { buildExportFileName } from "@/lib/export-filename";
import { deliverFile, type DeliverResult } from "@/lib/export-target";

// Delivers a .docx export: hits POST /api/documents/:id/export/docx (which
// shells out to the sibling anvilnote-docx-exporter repo via Pandoc) and
// writes the response the same way deliverPdf does — chosen folder if set,
// otherwise a plain download.
export async function deliverDocx(
  documentId: string,
  title: string,
  subfolder?: string,
): Promise<DeliverResult> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/documents/${documentId}/export/docx`,
    { method: "POST" },
  );
  if (!response.ok) {
    throw new Error(`DOCX export failed (${response.status})`);
  }
  const blob = await response.blob();
  const fileName = buildExportFileName(title).replace(/\.pdf$/i, ".docx");
  return deliverFile(blob, fileName, subfolder);
}
