import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/templates";
import type { AnvilDocument, AnvilMetadataValue } from "@/types/document";
import type { AnvilTemplate } from "@/types/template";
import type { ExportOptions } from "@/types/export";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ApiDocument = {
  id: string;
  title: string;
  content: unknown[];
  metadata?: Record<string, AnvilMetadataValue>;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiTemplate = {
  id: string;
  name: string;
  description: string | null;
  config: {
    fields?: AnvilTemplate["fields"];
    category?: AnvilTemplate["category"];
  } | null;
};

type ApiRenderResponse = {
  jobId: string;
  documentId: string;
  status: "COMPLETED" | "FAILED" | "PROCESSING" | "QUEUED";
  pdfUrl: string | null;
};

function apiUrl(pathname: string) {
  return `${API_BASE_URL}${pathname}`;
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
  return {
    id: document.id,
    title: document.title,
    blocks: Array.isArray(document.content) ? document.content : [],
    templateId: document.templateId ?? DEFAULT_TEMPLATE_ID,
    metadata: document.metadata ?? {},
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function getApiBaseUrl() {
  return API_BASE_URL;
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
  content: unknown[];
  metadata: Record<string, AnvilMetadataValue>;
  templateId: string | null;
}) {
  const response = await requestJson<ApiDocument>("/api/documents", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      content: input.content,
      metadata: input.metadata,
      templateId: input.templateId,
    }),
  });

  return fromApiDocument(response);
}

export async function updateDocument(
  id: string,
  input: Partial<{
    title: string;
    content: unknown[];
    metadata: Record<string, AnvilMetadataValue>;
    templateId: string | null;
  }>,
) {
  const response = await requestJson<ApiDocument>(`/api/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return fromApiDocument(response);
}

export async function deleteDocument(id: string) {
  await requestJson<{ id: string }>(`/api/documents/${id}`, {
    method: "DELETE",
  });
}

export async function renderDocument(id: string, exportOptions: ExportOptions) {
  return requestJson<ApiRenderResponse>(`/api/documents/${id}/render`, {
    method: "POST",
    body: JSON.stringify({
      exportOptions,
    }),
  });
}

export async function listTemplates(): Promise<AnvilTemplate[]> {
  const response = await requestJson<ApiTemplate[]>("/api/templates");
  return response.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    category: template.config?.category ?? "note",
    fields: template.config?.fields ?? [],
  }));
}
