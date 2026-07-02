import { sanitizeFilename } from "@/lib/export-filename";
import type { AnvilDocument } from "@/types/document";
import type { AnvilProject } from "@/types/project";

/**
 * The subfolder a document's exports should land in: its project's name, or
 * `unfiledLabel` (the localized "Unfiled" string) when it has none. Mirrors
 * the project structure into "<export dir>/AnvilNote/<this>/<file>" instead
 * of dumping every export flat.
 */
export function resolveExportFolder(
  doc: Pick<AnvilDocument, "projectId">,
  projects: Pick<AnvilProject, "id" | "name">[],
  unfiledLabel: string,
): string {
  const project = doc.projectId ? projects.find((p) => p.id === doc.projectId) : undefined;
  return sanitizeFilename(project?.name || unfiledLabel);
}
