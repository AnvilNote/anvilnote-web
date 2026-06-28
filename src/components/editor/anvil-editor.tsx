"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { schema, type AnvilSchema } from "@/components/editor/math-blocks";
import { DocumentTitle } from "@/components/editor/document-title";
import { AutosaveIndicator } from "@/components/editor/autosave-indicator";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useSettingsStore } from "@/lib/stores/settings-store";

// Isolate the editor surface so unrelated parent re-renders (save status,
// title) never reach BlockNoteView. Re-rendering the editor mid IME
// composition makes ProseMirror re-sync the DOM and duplicates the text being
// composed (e.g. Bopomofo "你好" turning into "你你好").
type AnvilEditorInstance = BlockNoteEditor<
  AnvilSchema["blockSchema"],
  AnvilSchema["inlineContentSchema"],
  AnvilSchema["styleSchema"]
>;

const EditorSurface = memo(function EditorSurface({
  editor,
  theme,
  onChange,
}: {
  editor: AnvilEditorInstance;
  theme: "dark" | "light";
  onChange: () => void;
}) {
  return <BlockNoteView editor={editor} theme={theme} onChange={onChange} />;
});

export function AnvilEditor({ documentId }: { documentId: string }) {
  const t = useTranslations();
  const { resolvedTheme } = useTheme();
  const renameDocument = useDocumentStore((s) => s.renameDocument);
  const setBlocks = useDocumentStore((s) => s.setBlocks);
  const status = useDocumentStore(
    (s) => s.saveStateById[documentId] ?? "saved",
  );
  const spellcheck = useSettingsStore((s) => s.spellcheck);

  const title = useDocumentStore(
    (s) => s.documents.find((d) => d.id === documentId)?.title ?? "",
  );

  // Snapshot the initial content once; the editor is uncontrolled afterwards.
  type AnvilPartialBlock = PartialBlock<
    AnvilSchema["blockSchema"],
    AnvilSchema["inlineContentSchema"],
    AnvilSchema["styleSchema"]
  >;
  const initialContent = useMemo<AnvilPartialBlock[] | undefined>(() => {
    const blocks = useDocumentStore.getState().getDocument(documentId)?.blocks;
    return blocks && blocks.length > 0
      ? (blocks as AnvilPartialBlock[])
      : undefined;
  }, [documentId]);

  const bnEditor = useCreateBlockNote({ schema, initialContent }, [documentId]);

  // True while an IME composition is in progress on the editor surface.
  const composingRef = useRef(false);

  // Stable change handler so the memoized EditorSurface never re-renders on
  // each keystroke. Skips work entirely while composing; the composition-end
  // listener flushes the final result. The store owns the single autosave
  // debounce, so this writes through on every change.
  const handleEditorChange = useCallback(() => {
    if (composingRef.current) return;
    setBlocks(documentId, bnEditor.document);
  }, [documentId, setBlocks, bnEditor]);

  // Reflect spellcheck preference and wire IME composition guards on the
  // editable surface.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editable = containerRef.current?.querySelector<HTMLElement>(
      "[contenteditable]",
    );
    if (!editable) return;

    editable.spellcheck = spellcheck;

    const onStart = () => {
      composingRef.current = true;
    };
    const onEnd = () => {
      composingRef.current = false;
      // Persist the now-completed text that was held back during composition.
      handleEditorChange();
    };
    editable.addEventListener("compositionstart", onStart);
    editable.addEventListener("compositionend", onEnd);
    return () => {
      editable.removeEventListener("compositionstart", onStart);
      editable.removeEventListener("compositionend", onEnd);
    };
  }, [spellcheck, handleEditorChange, bnEditor]);

  const editorTheme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[820px] items-center justify-end px-6 pt-6 sm:px-10">
        <AutosaveIndicator status={status} />
      </div>

      <div className="mx-auto w-full max-w-[820px] px-4 pb-4 pt-6">
        <DocumentTitle
          value={title}
          onChange={(value) => renameDocument(documentId, value)}
        />
      </div>

      <div
        ref={containerRef}
        className="anvil-editor mx-auto w-full max-w-[820px] flex-1 px-1 pb-32 sm:px-4"
      >
        <EditorSurface
          editor={bnEditor}
          theme={editorTheme}
          onChange={handleEditorChange}
        />
      </div>

      <span className="sr-only">{t("editor.writePlaceholder")}</span>
    </div>
  );
}
