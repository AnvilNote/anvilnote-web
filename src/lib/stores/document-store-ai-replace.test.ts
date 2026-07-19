import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnvilDocument } from "@/types/document";

const api = vi.hoisted(() => ({
  updateDocument: vi.fn(),
  createDocumentVersion: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  updateDocument: api.updateDocument,
  createDocumentVersion: api.createDocumentVersion,
}));

import { useDocumentStore } from "./document-store";

const original: AnvilDocument = {
  id: "doc-1",
  title: "Original title",
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Original" }] }] },
  metadata: { author: "Ada" },
  templateSettings: { accent: "blue" },
  templateId: "plain-note",
  numberedHeadings: true,
  marginTopCm: 2,
  marginBottomCm: 2,
  marginLeftCm: 2,
  marginRightCm: 2,
  projectId: "project-1",
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
};

describe("AI whole-document replacement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.updateDocument.mockResolvedValue({ ...original, updatedAt: "2026-07-19T01:00:00.000Z" });
    api.createDocumentVersion.mockResolvedValue({ id: "version-1" });
    useDocumentStore.setState({
      documents: [structuredClone(original)],
      saveStateById: { "doc-1": "saved" },
      restoreNonceById: {},
    });
  });

  it("persists content and a non-empty suggested title once while preserving document-owned settings", async () => {
    const content = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "AI title" }] }] };
    await useDocumentStore.getState().replaceWholeDocumentFromAI("doc-1", content, "AI title");

    expect(api.updateDocument).toHaveBeenCalledTimes(1);
    expect(api.updateDocument).toHaveBeenCalledWith("doc-1", {
      title: "AI title",
      content,
    });
    const saved = useDocumentStore.getState().getDocument("doc-1")!;
    expect(saved).toMatchObject({
      title: "AI title",
      content,
      metadata: original.metadata,
      templateSettings: original.templateSettings,
      templateId: original.templateId,
      projectId: original.projectId,
      marginTopCm: 2,
    });
  });

  it("keeps the existing title when the draft has no suggested title", async () => {
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "AI content" }] }] };
    await useDocumentStore.getState().replaceWholeDocumentFromAI("doc-1", content, "   ");

    expect(api.updateDocument).toHaveBeenCalledWith("doc-1", {
      title: "Original title",
      content,
    });
  });

  it("does not alter the live document when the confirmed replacement cannot be persisted", async () => {
    api.updateDocument.mockRejectedValueOnce(new Error("offline"));
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Unsaved AI content" }] }] };

    await expect(
      useDocumentStore.getState().replaceWholeDocumentFromAI("doc-1", content, "AI title"),
    ).rejects.toThrow("Failed to save AI document replacement");

    expect(useDocumentStore.getState().getDocument("doc-1")).toEqual(original);
    expect(useDocumentStore.getState().saveStateById["doc-1"]).toBe("failed");
  });

  it("remounts the uncontrolled editor after a persisted full-document replacement", async () => {
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "AI content" }] }] };
    await useDocumentStore.getState().replaceWholeDocumentFromAI("doc-1", content, null);

    expect(useDocumentStore.getState().restoreNonceById["doc-1"]).toBe(1);
  });
});
