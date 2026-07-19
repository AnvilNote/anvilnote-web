"use client";

import { create } from "zustand";
import type { JSONContent } from "@tiptap/core";
import type {
  AnvilDocument,
  AnvilDocumentVersionSummary,
  AnvilMetadataValue,
} from "@/types/document";
import type { ExportOptions } from "@/types/export";
import { buildDefaultContent } from "@/lib/tiptap/default-content";
import { buildExportPayload } from "@/lib/export";
import {
  createDocument as createDocumentRequest,
  createDocumentVersion,
  deleteDocument as deleteDocumentRequest,
  listDocuments,
  listDocumentVersions,
  renderDocument as renderDocumentRequest,
  restoreDocumentVersion,
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

// When each document last got a version-history snapshot, and what its
// content looked like at that point — both session-only (not persisted; if
// the app restarts, the next due save just snapshots a bit earlier than it
// otherwise would, which is harmless). Content is compared as a JSON string
// since Tiptap docs don't carry a revision/hash of their own.
const lastSnapshotAt = new Map<string, number>();
const lastSnapshottedContent = new Map<string, string>();

// Called after every successful save. A snapshot is a deliberate, coarser
// checkpoint than autosave — firing on every save (as often as every 600ms
// while actively typing) would make "version history" meaningless noise —
// so on a normal (autosave-triggered) save this only actually creates one
// once the user's configured interval has elapsed AND the content has
// changed since the last snapshot. A *manual* save (the topbar Save button
// — see app-topbar.tsx) skips the interval check entirely: a deliberate
// click is already the kind of meaningful checkpoint the interval exists to
// approximate for autosave, so gating it the same way just makes a manual
// save feel broken ("I hit save and nothing happened in history"). The
// interval-off switch (0) still wins either way — it's an explicit opt-out
// of the whole feature, not a throttle a manual save should bypass.
// Best-effort: a failure here must never surface as a save failure to the
// user, since the document itself was already saved successfully.
function maybeSnapshotVersion(document: AnvilDocument, options?: { manual?: boolean }) {
  const intervalMinutes = useSettingsStore.getState().versionSnapshotIntervalMinutes;
  if (intervalMinutes <= 0) return;

  const now = Date.now();
  const last = lastSnapshotAt.get(document.id) ?? 0;
  if (!options?.manual && now - last < intervalMinutes * 60_000) return;

  const contentJson = JSON.stringify(document.content);
  if (lastSnapshottedContent.get(document.id) === contentJson) return;

  // Only recorded once the snapshot actually succeeds — marking it done
  // beforehand would mean a failed request silently gets treated as a
  // completed checkpoint, and no snapshot would be attempted again until a
  // full interval later.
  void createDocumentVersion(document.id)
    .then((created) => {
      lastSnapshotAt.set(document.id, now);
      lastSnapshottedContent.set(document.id, contentJson);
      // versionsById is the history panel's only data source (see
      // version-history-panel.tsx) — prepending here means a snapshot that
      // fires while that panel is open shows up immediately, without the
      // user having to leave and reopen the tab to see it. Left untouched
      // if never loaded (undefined) — nothing to prepend onto, and the
      // panel will fetch the full list fresh whenever it's first opened.
      useDocumentStore.setState((state) => {
        const existing = state.versionsById[document.id];
        if (!existing) return state;
        return {
          versionsById: {
            ...state.versionsById,
            [document.id]: [created, ...existing],
          },
        };
      });
    })
    .catch((error) => {
      console.error("Failed to create version snapshot:", error);
    });
}

type DocumentState = {
  documents: AnvilDocument[];
  activeId: string | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  saveStateById: Record<string, "saved" | "saving" | "unsaved" | "failed">;
  renderingById: Record<string, boolean>;
  // Bumped whenever a document's content is overwritten by something other
  // than the live editor itself (currently just restoreVersion). The editor
  // is intentionally uncontrolled — see setContent's comment — so it only
  // ever reads content once, on mount; the page component keys the editor
  // on this value (alongside documentId) specifically to force a fresh
  // mount and pick up the restored content, the same way navigating to a
  // different document already does.
  restoreNonceById: Record<string, number>;
  // Loaded lazily (see loadVersions) and kept in the store — not local
  // component state — specifically so version-history-panel.tsx re-renders
  // automatically whenever a snapshot fires or a restore happens, instead
  // of only refreshing when the panel's own tab becomes active again.
  // Undefined means "never loaded yet" (distinct from an empty array).
  versionsById: Record<string, AnvilDocumentVersionSummary[] | undefined>;
  loadVersions: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  hydrate: () => Promise<void>;
  createDocument: (
    templateId?: string,
    title?: string,
    seed?: { heading?: string; body?: string },
    projectId?: string | null,
  ) => Promise<AnvilDocument>;
  duplicateDocument: (id: string) => Promise<AnvilDocument | undefined>;
  importDocument: (input: {
    title: string;
    content: JSONContent;
    metadata: Record<string, AnvilMetadataValue>;
    templateSettings: Record<string, AnvilMetadataValue>;
    templateId: string;
    projectId: string | null;
  }) => Promise<AnvilDocument>;
  setDocumentProject: (id: string, projectId: string | null) => Promise<void>;
  unfileDocuments: (projectId: string) => void;
  deleteDocument: (id: string) => Promise<void>;
  renameDocument: (id: string, title: string) => void;
  setContent: (id: string, content: JSONContent) => void;
  snapshotBeforeAIInsert: (id: string, content: JSONContent) => Promise<void>;
  replaceWholeDocumentFromAI: (
    id: string,
    content: JSONContent,
    suggestedTitle?: string | null,
  ) => Promise<AnvilDocument | undefined>;
  setMetadataField: (id: string, key: string, value: AnvilMetadataValue) => void;
  setTemplateSettingField: (id: string, key: string, value: AnvilMetadataValue) => void;
  setNumberedHeadings: (id: string, value: boolean) => void;
  setMarginCm: (
    id: string,
    side: "top" | "bottom" | "left" | "right",
    value: number | null,
  ) => void;
  setTemplate: (id: string, templateId: string) => void;
  saveDocument: (id: string, options?: { manual?: boolean }) => Promise<AnvilDocument | undefined>;
  restoreVersion: (id: string, versionId: string) => Promise<void>;
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
  restoreNonceById: {},
  versionsById: {},

  loadVersions: async (id) => {
    const versions = await listDocumentVersions(id);
    set((state) => ({
      versionsById: { ...state.versionsById, [id]: versions },
    }));
  },

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

  createDocument: async (
    templateId = DEFAULT_TEMPLATE_ID,
    title = "Untitled Note",
    seed,
    projectId = null,
  ) => {
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
    // Same pattern for `author`: seeded from Settings' defaultAuthor (a
    // starting value only — never re-applied to an already-saved
    // document, and always freely editable per-document afterwards).
    // Empty defaultAuthor (the common case for a user who hasn't set one)
    // intentionally leaves the field at its own seedValue default instead
    // of overwriting it with "".
    const defaultAuthor = useSettingsStore.getState().defaultAuthor.trim();
    if (
      defaultAuthor &&
      template?.fields.some(
        (field) => field.scope === "metadata" && field.key === "author",
      )
    ) {
      metadata.author = defaultAuthor;
    }
    const document = await createDocumentRequest({
      title,
      content: buildDefaultContent(seed?.heading, seed?.body),
      metadata,
      templateSettings: seedTemplateSettings(template),
      templateId,
      numberedHeadings: true,
      // 2.54cm (1in) all around — a plain, familiar default (matches the
      // classic "1 inch margin" most word processors ship with) rather
      // than silently inheriting whatever a given template's own built-in
      // margin happens to be. A user can still clear a field back to
      // empty/null to fall back to the active template's own default.
      marginTopCm: 2.54,
      marginBottomCm: 2.54,
      marginLeftCm: 2.54,
      marginRightCm: 2.54,
      projectId,
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

  setDocumentProject: async (id, projectId) => {
    // Optimistic: reflect locally, then persist. Roll back on failure.
    const previous = get().documents.find((d) => d.id === id)?.projectId ?? null;
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id ? { ...d, projectId } : d,
      ),
    }));
    try {
      await updateDocumentRequest(id, { projectId });
    } catch {
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === id ? { ...d, projectId: previous } : d,
        ),
      }));
      throw new Error("Failed to move document");
    }
  },

  // Local-only: the API already SET NULL on the column when the project was
  // deleted. Mirror that so the sidebar moves these docs to "unfiled".
  unfileDocuments: (projectId) => {
    set((state) => ({
      documents: state.documents.map((d) =>
        d.projectId === projectId ? { ...d, projectId: null } : d,
      ),
    }));
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
      numberedHeadings: source.numberedHeadings,
      marginTopCm: source.marginTopCm,
      marginBottomCm: source.marginBottomCm,
      marginLeftCm: source.marginLeftCm,
      marginRightCm: source.marginRightCm,
      projectId: source.projectId,
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

  // Used by the Markdown/zip import feature: creates a document with fully
  // custom content/metadata (unlike createDocument, which always seeds a
  // fresh blank document) — mirrors duplicateDocument's create+push pattern.
  importDocument: async (input) => {
    const document = await createDocumentRequest(input);
    set((state) => ({
      documents: [document, ...state.documents],
      saveStateById: {
        ...state.saveStateById,
        [document.id]: "saved",
      },
    }));
    return document;
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

  // An AI insertion is applied directly to the live editor, so capture the
  // exact editor JSON before that transaction runs. The version endpoint
  // snapshots the already-persisted Document row; persist first, then create
  // the version in sequence so a pending autosave cannot turn this into a
  // post-insert snapshot. This deliberately ignores the user's periodic
  // snapshot interval: accepting AI content is an explicit safety boundary.
  snapshotBeforeAIInsert: async (id, content) => {
    const current = get().documents.find((document) => document.id === id);
    if (!current) throw new Error("Document not found");

    const queued = saveTimers.get(id);
    if (queued) {
      clearTimeout(queued);
      saveTimers.delete(id);
    }

    set((state) => ({
      saveStateById: { ...state.saveStateById, [id]: "saving" },
    }));

    try {
      const saved = await updateDocumentRequest(id, {
        title: current.title,
        content,
        metadata: current.metadata,
        templateSettings: current.templateSettings,
        templateId: current.templateId,
        numberedHeadings: current.numberedHeadings,
        marginTopCm: current.marginTopCm,
        marginBottomCm: current.marginBottomCm,
        marginLeftCm: current.marginLeftCm,
        marginRightCm: current.marginRightCm,
      });
      const created = await createDocumentVersion(id);
      const contentJson = JSON.stringify(content);
      lastSnapshotAt.set(id, Date.now());
      lastSnapshottedContent.set(id, contentJson);

      set((state) => {
        const existingVersions = state.versionsById[id];
        return {
          documents: state.documents.map((document) =>
            document.id === id ? { ...document, updatedAt: saved.updatedAt } : document,
          ),
          saveStateById: { ...state.saveStateById, [id]: "saved" },
          ...(existingVersions
            ? {
                versionsById: {
                  ...state.versionsById,
                  [id]: [created, ...existingVersions],
                },
              }
            : {}),
        };
      });
    } catch {
      set((state) => ({
        saveStateById: { ...state.saveStateById, [id]: "failed" },
      }));
      throw new Error("Failed to snapshot document before AI insertion");
    }
  },

  // A confirmed AI full-document replacement is one deliberate user action.
  // Keep the document's template/project/settings untouched and persist its
  // content (and a non-empty suggested title, if any) in exactly one PATCH.
  // Tiptap's onUpdate may have queued a normal autosave while applying the
  // same transaction, so cancel it before the direct write.
  replaceWholeDocumentFromAI: async (id, content, suggestedTitle) => {
    const current = get().documents.find((document) => document.id === id);
    if (!current) return undefined;

    const queued = saveTimers.get(id);
    if (queued) {
      clearTimeout(queued);
      saveTimers.delete(id);
    }

    const nextTitle = suggestedTitle?.trim() || current.title;
    const titleChanged = nextTitle !== current.title;
    const template = useTemplatesStore.getState().getTemplate(current.templateId);
    const hasTitleField = template?.fields.some(
      (field) => field.scope === "metadata" && field.key === "title",
    );
    const nextMetadata =
      titleChanged && hasTitleField
        ? { ...current.metadata, title: nextTitle }
        : current.metadata;
    const replacement = touch(current, {
      content,
      ...(titleChanged ? { title: nextTitle } : {}),
      ...(nextMetadata !== current.metadata ? { metadata: nextMetadata } : {}),
    });

    // Keep the live editor and document store on the existing document until
    // the single replacement PATCH succeeds. A full replacement is
    // destructive enough that a failed network write must not leave a local
    // document which looks saved but cannot be recovered from the API.
    set((state) => ({
      saveStateById: { ...state.saveStateById, [id]: "saving" },
    }));

    try {
      const saved = await updateDocumentRequest(id, {
        title: replacement.title,
        content: replacement.content,
        ...(nextMetadata !== current.metadata ? { metadata: replacement.metadata } : {}),
      });
      set((state) => ({
        documents: state.documents.map((document) =>
          document.id === id ? { ...replacement, updatedAt: saved.updatedAt } : document,
        ),
        saveStateById: { ...state.saveStateById, [id]: "saved" },
        // Tiptap is intentionally uncontrolled, so a persisted full-document
        // replacement needs the same remount signal as restoring a version.
        restoreNonceById: {
          ...state.restoreNonceById,
          [id]: (state.restoreNonceById[id] ?? 0) + 1,
        },
      }));
      maybeSnapshotVersion(replacement);
      return saved;
    } catch {
      set((state) => ({
        saveStateById: { ...state.saveStateById, [id]: "failed" },
      }));
      throw new Error("Failed to save AI document replacement");
    }
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

  setNumberedHeadings: (id, value) => {
    set((state) => ({
      documents: state.documents.map((document) =>
        document.id === id ? touch(document, { numberedHeadings: value }) : document,
      ),
    }));
    scheduleSave(id);
  },

  setMarginCm: (id, side, value) => {
    const key = (
      { top: "marginTopCm", bottom: "marginBottomCm", left: "marginLeftCm", right: "marginRightCm" } as const
    )[side];
    set((state) => ({
      documents: state.documents.map((document) =>
        document.id === id ? touch(document, { [key]: value }) : document,
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

  saveDocument: async (id, options) => {
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
        title: document.title,
        content: document.content,
        metadata: document.metadata,
        templateSettings: document.templateSettings,
        templateId: document.templateId,
        numberedHeadings: document.numberedHeadings,
        marginTopCm: document.marginTopCm,
        marginBottomCm: document.marginBottomCm,
        marginLeftCm: document.marginLeftCm,
        marginRightCm: document.marginRightCm,
      });

      // Don't overwrite the local document with the server echo: the user may
      // have kept typing while the request was in flight, and replacing the
      // whole object round-trips the title/content back through the store —
      // which resets an empty title to its fallback and flashes the editor on
      // every autosave. Only sync the server-owned timestamp.
      set((state) => ({
        documents: state.documents.map((entry) =>
          entry.id === id ? { ...entry, updatedAt: saved.updatedAt } : entry,
        ),
        saveStateById: {
          ...state.saveStateById,
          [id]: "saved",
        },
      }));

      maybeSnapshotVersion(document, { manual: options?.manual });

      return saved;
    } catch {
      set((state) => ({
        saveStateById: {
          ...state.saveStateById,
          [id]: "failed",
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

  restoreVersion: async (id, versionId) => {
    const restored = await restoreDocumentVersion(id, versionId);
    set((state) => ({
      documents: state.documents.map((entry) => (entry.id === id ? restored : entry)),
      saveStateById: {
        ...state.saveStateById,
        [id]: "saved",
      },
      restoreNonceById: {
        ...state.restoreNonceById,
        [id]: (state.restoreNonceById[id] ?? 0) + 1,
      },
    }));
    // The server already created a version for both the pre-restore state
    // and the restored content itself (see the API's restoreVersion), so
    // treat this moment as freshly snapshotted — otherwise the very next
    // autosave would immediately create a redundant duplicate version of
    // content that's already represented in history twice over.
    lastSnapshotAt.set(id, Date.now());
    lastSnapshottedContent.set(id, JSON.stringify(restored.content));
    // Two new versions exist server-side now (see above) that we don't
    // have summaries for locally — a full refetch, not a prepend, is the
    // simplest way to pick both up correctly.
    void get().loadVersions(id);
  },
}));
