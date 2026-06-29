"use client";

import { create } from "zustand";
import type { JSONContent } from "@tiptap/core";
import type { AnvilDocument, AnvilMetadataValue } from "@/types/document";
import type { ExportOptions } from "@/types/export";
import { defaultTiptapContent } from "@/lib/tiptap/default-content";
import { buildExportPayload } from "@/lib/export";
import {
  createDocument as createDocumentRequest,
  deleteDocument as deleteDocumentRequest,
  listDocuments,
  renderDocument as renderDocumentRequest,
  updateDocument as updateDocumentRequest,
} from "@/lib/api";
import {
  DEFAULT_TEMPLATE_ID,
  seedMetadata,
  seedTemplateSettings,
} from "@/lib/templates/templates";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

type DocumentState = {
  documents: AnvilDocument[];
  activeId: string | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  saveStateById: Record<string, "saved" | "saving" | "unsaved">;
  renderingById: Record<string, boolean>;
  setActive: (id: string | null) => void;
  hydrate: () => Promise<void>;
  createDocument: (templateId?: string, title?: string) => Promise<AnvilDocument>;
  duplicateDocument: (id: string) => Promise<AnvilDocument | undefined>;
  deleteDocument: (id: string) => Promise<void>;
  renameDocument: (id: string, title: string) => void;
  setContent: (id: string, content: JSONContent) => void;
  setMetadataField: (id: string, key: string, value: AnvilMetadataValue) => void;
  setTemplateSettingField: (id: string, key: string, value: AnvilMetadataValue) => void;
  setTemplate: (id: string, templateId: string) => void;
  saveDocument: (id: string) => Promise<AnvilDocument | undefined>;
  renderDocument: (id: string, exportOptions: ExportOptions) => Promise<{ pdfUrl: string | null }>;
  getDocument: (id: string) => AnvilDocument | undefined;
};

function touch(doc: AnvilDocument, patch: Partial<AnvilDocument>): AnvilDocument {
  return { ...doc, ...patch, updatedAt: new Date().toISOString() };
}

// Single source of save debouncing for every local mutation. The editor no
// longer debounces on its own, so this is the only timer between a keystroke
// and the network write.
function scheduleSave(id: string) {
  const existing = saveTimers.get(id);
  if (existing) {
    clearTimeout(existing);
  }

  useDocumentStore.setState((state) => ({
    saveStateById: {
      ...state.saveStateById,
      [id]: "unsaved",
    },
  }));

  // With autosave off the change stays in the store and is marked unsaved;
  // the user persists it explicitly via the manual save action.
  if (!useSettingsStore.getState().autosave) {
    saveTimers.delete(id);
    return;
  }

  const timer = setTimeout(() => {
    saveTimers.delete(id);
    void useDocumentStore.getState().saveDocument(id);
  }, 600);

  saveTimers.set(id, timer);
}

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  documents: [],
  activeId: null,
  hydrated: false,
  loading: false,
  error: null,
  saveStateById: {},
  renderingById: {},

  setActive: (id) => set({ activeId: id }),

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const documents = await listDocuments();
      set((state) => ({
        documents,
        hydrated: true,
        loading: false,
        activeId:
          state.activeId && documents.some((document) => document.id === state.activeId)
            ? state.activeId
            : documents[0]?.id ?? null,
      }));
    } catch (error) {
      set({
        hydrated: true,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load documents",
      });
    }
  },

  createDocument: async (templateId = DEFAULT_TEMPLATE_ID, title = "Untitled Note") => {
    const template = useTemplatesStore.getState().getTemplate(templateId);
    const metadata = seedMetadata(template);
    // If the template exposes a `title` metadata field, default it to the
    // document title so a brand-new doc clears the required-title gate without
    // forcing the user to type anything. They can still rename it afterwards.
    if (
      template?.fields.some(
        (field) => field.scope === "metadata" && field.key === "title",
      )
    ) {
      metadata.title = title;
    }
    const document = await createDocumentRequest({
      title,
      content: structuredClone(defaultTiptapContent),
      metadata,
      templateSettings: seedTemplateSettings(template),
      templateId,
    });

    set((state) => ({
      documents: [document, ...state.documents],
      activeId: document.id,
      saveStateById: {
        ...state.saveStateById,
        [document.id]: "saved",
      },
    }));

    return document;
  },

  duplicateDocument: async (id) => {
    const source = get().documents.find((document) => document.id === id);
    if (!source) {
      return undefined;
    }

    const duplicate = await createDocumentRequest({
      title: source.title || "Untitled Note",
      content: source.content,
      metadata: source.metadata,
      templateSettings: source.templateSettings,
      templateId: source.templateId,
    });

    set((state) => ({
      documents: [duplicate, ...state.documents],
      activeId: duplicate.id,
      saveStateById: {
        ...state.saveStateById,
        [duplicate.id]: "saved",
      },
    }));

    return duplicate;
  },

  deleteDocument: async (id) => {
    await deleteDocumentRequest(id);
    set((state) => {
      const documents = state.documents.filter((document) => document.id !== id);
      return {
        documents,
        activeId:
          state.activeId === id ? (documents[0]?.id ?? null) : state.activeId,
      };
    });
  },

  renameDocument: (id, title) => {
    set((state) => ({
      documents: state.documents.map((document) => {
        if (document.id !== id) {
          return document;
        }
        // One-way sync: the document title mirrors into the `title` metadata
        // field when the template exposes one. The reverse never happens —
        // editing the metadata field only touches metadata, not the title.
        const template = useTemplatesStore
          .getState()
          .getTemplate(document.templateId);
        const hasTitleField = template?.fields.some(
          (field) => field.scope === "metadata" && field.key === "title",
        );
        return touch(
          document,
          hasTitleField
            ? { title, metadata: { ...document.metadata, title } }
            : { title },
        );
      }),
    }));
    scheduleSave(id);
  },

  setContent: (id, content) => {
    set((state) => ({
      documents: state.documents.map((document) =>
        document.id === id ? touch(document, { content }) : document,
      ),
    }));
    scheduleSave(id);
  },

  setMetadataField: (id, key, value) => {
    set((state) => ({
      documents: state.documents.map((document) =>
        document.id === id
          ? touch(document, { metadata: { ...document.metadata, [key]: value } })
          : document,
      ),
    }));
    scheduleSave(id);
  },

  setTemplateSettingField: (id, key, value) => {
    set((state) => ({
      documents: state.documents.map((document) =>
        document.id === id
          ? touch(document, {
              templateSettings: { ...document.templateSettings, [key]: value },
            })
          : document,
      ),
    }));
    scheduleSave(id);
  },

  setTemplate: (id, templateId) => {
    const template = useTemplatesStore.getState().getTemplate(templateId);
    set((state) => ({
      documents: state.documents.map((document) =>
        document.id === id
          ? touch(document, {
              templateId,
              // Metadata is kept across templates; only the option bucket is
              // rebuilt for the new template (same-named values preserved).
              templateSettings: seedTemplateSettings(template, document.templateSettings),
            })
          : document,
      ),
    }));
    scheduleSave(id);
  },

  saveDocument: async (id) => {
    const document = get().documents.find((entry) => entry.id === id);
    if (!document) {
      return undefined;
    }

    set((state) => ({
      saveStateById: {
        ...state.saveStateById,
        [id]: "saving",
      },
    }));

    try {
      const saved = await updateDocumentRequest(id, {
        title: document.title || "Untitled Note",
        content: document.content,
        metadata: document.metadata,
        templateSettings: document.templateSettings,
        templateId: document.templateId,
      });

      set((state) => ({
        documents: state.documents.map((entry) => (entry.id === id ? saved : entry)),
        saveStateById: {
          ...state.saveStateById,
          [id]: "saved",
        },
      }));

      return saved;
    } catch {
      set((state) => ({
        saveStateById: {
          ...state.saveStateById,
          [id]: "unsaved",
        },
      }));
      throw new Error("Failed to save document");
    }
  },

  renderDocument: async (id, exportOptions) => {
    set((state) => ({
      renderingById: {
        ...state.renderingById,
        [id]: true,
      },
    }));

    try {
      await get().saveDocument(id);
      const document = get().documents.find((entry) => entry.id === id);
      if (!document) {
        throw new Error("Document not found");
      }
      const result = await renderDocumentRequest(
        id,
        buildExportPayload(document, exportOptions),
      );
      return { pdfUrl: result.pdfUrl };
    } finally {
      set((state) => ({
        renderingById: {
          ...state.renderingById,
          [id]: false,
        },
      }));
    }
  },

  getDocument: (id) => get().documents.find((document) => document.id === id),
}));
