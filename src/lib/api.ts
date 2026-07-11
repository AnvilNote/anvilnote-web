import type { JSONContent } from "@tiptap/core";
import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/templates";
import {
  migratedDocIds,
  normalizeTiptapContent,
  toWireContent,
} from "@/lib/tiptap/serialization";
import type {
  AnvilDocument,
  AnvilDocumentVersion,
  AnvilDocumentVersionSummary,
  AnvilMetadataValue,
} from "@/types/document";
import type { AnvilProject } from "@/types/project";
import type { AnvilTemplate } from "@/types/template";
import type { ExportPayload } from "@/types/export";

// Build-time default. In the desktop shell the API port is chosen at launch and
// surfaced at runtime via the preload bridge (window.anvilnote.getApiBaseUrl()),
// so resolveApiBaseUrl() prefers that when present.
const BUILD_TIME_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

declare global {
  interface Window {
    anvilnote?: {
      getApiBaseUrl?: () => string | null;
      getAppVersion?: () => string | null;
      // Native "export to a folder" bridge — see lib/export-target.ts. Only
      // present on desktop; the browser's File System Access API is used
      // instead when it's absent.
      pickExportDir?: () => Promise<string | null>;
      writeExportFile?: (
        dirPath: string,
        segments: string[],
        data: Uint8Array,
      ) => Promise<string>;
    };
  }
}

function resolveApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const bridged = window.anvilnote?.getApiBaseUrl?.();
    if (bridged) return bridged;
  }
  return BUILD_TIME_API_BASE_URL;
}

type ApiDocument = {
  id: string;
  title: string;
  content: unknown;
  metadata?: Record<string, AnvilMetadataValue>;
  templateSettings?: Record<string, AnvilMetadataValue>;
  templateId: string | null;
  numberedHeadings: boolean;
  marginTopCm?: number | null;
  marginBottomCm?: number | null;
  marginLeftCm?: number | null;
  marginRightCm?: number | null;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiProject = {
  id: string;
  name: string;
  icon?: string | null;
  createdAt: string;
  updatedAt: string;
};

// Matches the API's template summary (renderer manifest, minus engine/fonts).
type ApiTemplate = {
  slug: string;
  name: string;
  description: string | null;
  version?: string;
  category?: string;
  tags?: string[];
  fields?: AnvilTemplate["fields"];
  textWidthCm?: number;
  universeUrl?: string;
  supportsNumberedHeadings?: boolean;
  supportsCustomMargins?: boolean;
};

type ApiRenderResponse = {
  id: string;
  documentId: string;
  status: "COMPLETED" | "FAILED" | "PROCESSING";
  pdfUrl: string | null;
};

type ApiDocumentVersionSummary = {
  id: string;
  documentId: string;
  title: string;
  createdAt: string;
};

type ApiDocumentVersion = ApiDocumentVersionSummary & {
  content: unknown;
  metadata?: Record<string, AnvilMetadataValue>;
  templateSettings?: Record<string, AnvilMetadataValue>;
};

function apiUrl(pathname: string) {
  return `${resolveApiBaseUrl()}${pathname}`;
}

async function requestJson<T>(pathname: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(pathname), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as
    | { data: T }
    | { error?: { message?: string; details?: unknown } };

  if (!response.ok || !("data" in payload)) {
    const message =
      "error" in payload && payload.error?.message
        ? payload.error.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload.data;
}

function fromApiDocument(document: ApiDocument): AnvilDocument {
  // Stored content is Tiptap JSON. Legacy (BlockNote) content is incompatible —
  // normalize resets it to an empty doc and flags the id so the editor can warn.
  const { content, migrated } = normalizeTiptapContent(document.content);
  if (migrated) {
    migratedDocIds.add(document.id);
  }
  return {
    id: document.id,
    title: document.title,
    content,
    templateId: document.templateId ?? DEFAULT_TEMPLATE_ID,
    metadata: document.metadata ?? {},
    templateSettings: document.templateSettings ?? {},
    numberedHeadings: document.numberedHeadings,
    marginTopCm: document.marginTopCm ?? null,
    marginBottomCm: document.marginBottomCm ?? null,
    marginLeftCm: document.marginLeftCm ?? null,
    marginRightCm: document.marginRightCm ?? null,
    projectId: document.projectId ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function fromApiVersionSummary(version: ApiDocumentVersionSummary): AnvilDocumentVersionSummary {
  return {
    id: version.id,
    documentId: version.documentId,
    title: version.title,
    createdAt: version.createdAt,
  };
}

function fromApiVersion(version: ApiDocumentVersion): AnvilDocumentVersion {
  // Version content went through the same wire format as a document's own
  // content (see toWireContent below) — normalize it the same way rather
  // than trusting it's already valid Tiptap JSON.
  const { content } = normalizeTiptapContent(version.content);
  return {
    ...fromApiVersionSummary(version),
    content,
    metadata: version.metadata ?? {},
    templateSettings: version.templateSettings ?? {},
  };
}

function fromApiProject(project: ApiProject): AnvilProject {
  return {
    id: project.id,
    name: project.name,
    icon: project.icon ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function fromApiTemplate(template: ApiTemplate): AnvilTemplate {
  return {
    id: template.slug,
    name: template.name,
    description: template.description ?? "",
    version: template.version ?? "",
    category: template.category ?? "note",
    tags: template.tags ?? [],
    fields: template.fields ?? [],
    // 16cm matches the most common value across templates (plain-note,
    // bananote, bubble, ...) — a reasonable fallback for the rare case of
    // a stale/incomplete API response missing this field entirely, not a
    // real per-template measurement.
    textWidthCm: template.textWidthCm ?? 16,
    universeUrl: template.universeUrl,
    supportsNumberedHeadings: template.supportsNumberedHeadings ?? false,
    supportsCustomMargins: template.supportsCustomMargins ?? false,
  };
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl();
}

export async function listDocuments() {
  const response = await requestJson<ApiDocument[]>("/api/documents");
  return response.map(fromApiDocument);
}

export async function getDocument(id: string) {
  const response = await requestJson<ApiDocument>(`/api/documents/${id}`);
  return fromApiDocument(response);
}

export async function createDocument(input: {
  title: string;
  content: JSONContent;
  metadata: Record<string, AnvilMetadataValue>;
  templateSettings: Record<string, AnvilMetadataValue>;
  templateId: string | null;
  numberedHeadings?: boolean;
  marginTopCm?: number | null;
  marginBottomCm?: number | null;
  marginLeftCm?: number | null;
  marginRightCm?: number | null;
  projectId?: string | null;
}) {
  const response = await requestJson<ApiDocument>("/api/documents", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      content: toWireContent(input.content),
      metadata: input.metadata,
      templateSettings: input.templateSettings,
      templateId: input.templateId,
      numberedHeadings: input.numberedHeadings ?? true,
      marginTopCm: input.marginTopCm ?? null,
      marginBottomCm: input.marginBottomCm ?? null,
      marginLeftCm: input.marginLeftCm ?? null,
      marginRightCm: input.marginRightCm ?? null,
      projectId: input.projectId ?? null,
    }),
  });

  return fromApiDocument(response);
}

export async function updateDocument(
  id: string,
  input: Partial<{
    title: string;
    content: JSONContent;
    metadata: Record<string, AnvilMetadataValue>;
    templateSettings: Record<string, AnvilMetadataValue>;
    templateId: string | null;
    numberedHeadings: boolean;
    marginTopCm: number | null;
    marginBottomCm: number | null;
    marginLeftCm: number | null;
    marginRightCm: number | null;
    projectId: string | null;
  }>,
) {
  const response = await requestJson<ApiDocument>(`/api/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...input,
      // Wrap the Tiptap doc to satisfy the API's array `content` contract.
      ...(input.content !== undefined
        ? { content: toWireContent(input.content) }
        : {}),
    }),
  });

  return fromApiDocument(response);
}

export async function listDocumentVersions(documentId: string) {
  const response = await requestJson<ApiDocumentVersionSummary[]>(
    `/api/documents/${documentId}/versions`,
  );
  return response.map(fromApiVersionSummary);
}

export async function getDocumentVersion(documentId: string, versionId: string) {
  const response = await requestJson<ApiDocumentVersion>(
    `/api/documents/${documentId}/versions/${versionId}`,
  );
  return fromApiVersion(response);
}

// Snapshots the document's CURRENT persisted state — the caller must save
// first (see document-store.ts), since this doesn't take a content payload;
// it just tells the server "copy what's there now into a new version row".
export async function createDocumentVersion(documentId: string) {
  const response = await requestJson<ApiDocumentVersionSummary>(
    `/api/documents/${documentId}/versions`,
    { method: "POST" },
  );
  return fromApiVersionSummary(response);
}

export async function restoreDocumentVersion(documentId: string, versionId: string) {
  const response = await requestJson<ApiDocument>(
    `/api/documents/${documentId}/versions/${versionId}/restore`,
    { method: "POST" },
  );
  return fromApiDocument(response);
}

export async function deleteDocument(id: string) {
  await requestJson<{ id: string }>(`/api/documents/${id}`, {
    method: "DELETE",
  });
}

export async function renderDocument(id: string, payload: ExportPayload) {
  return requestJson<ApiRenderResponse>(`/api/documents/${id}/render`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listTemplates(): Promise<AnvilTemplate[]> {
  const response = await requestJson<ApiTemplate[]>("/api/templates");
  return response.map(fromApiTemplate);
}

export async function getTemplate(slug: string): Promise<AnvilTemplate> {
  const response = await requestJson<ApiTemplate>(`/api/templates/${slug}`);
  return fromApiTemplate(response);
}

export async function listProjects(): Promise<AnvilProject[]> {
  const response = await requestJson<ApiProject[]>("/api/projects");
  return response.map(fromApiProject);
}

export async function createProject(input: {
  name: string;
  icon: string | null;
}): Promise<AnvilProject> {
  const response = await requestJson<ApiProject>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return fromApiProject(response);
}

export async function updateProject(
  id: string,
  input: Partial<{ name: string; icon: string | null }>,
): Promise<AnvilProject> {
  const response = await requestJson<ApiProject>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return fromApiProject(response);
}

export async function deleteProject(id: string) {
  await requestJson<{ id: string }>(`/api/projects/${id}`, {
    method: "DELETE",
  });
}
