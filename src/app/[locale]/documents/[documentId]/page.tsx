"use client";

import { use, useEffect } from "react";
import { AnvilEditor } from "@/components/editor/anvil-editor";
import { EditorEmptyState } from "@/components/editor/editor-empty-state";
import { RightPanel } from "@/components/app/right-panel";
import { useDocumentStore } from "@/lib/stores/document-store";

export default function DocumentEditorPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = use(params);

  const exists = useDocumentStore((s) =>
    s.documents.some((d) => d.id === documentId),
  );
  const hydrated = useDocumentStore((s) => s.hydrated);
  const setActive = useDocumentStore((s) => s.setActive);
  // The editor is intentionally uncontrolled (see document-store.ts's
  // setContent comment) — it only reads content once, on mount. Restoring a
  // version overwrites the store's content directly, so the key includes
  // restoreNonceById to force a remount and pick that up, same as switching
  // documents already does via documentId.
  const restoreNonce = useDocumentStore((s) => s.restoreNonceById[documentId] ?? 0);

  useEffect(() => {
    if (exists) setActive(documentId);
  }, [exists, documentId, setActive]);

  if (!hydrated) {
    return null;
  }

  if (!exists) {
    return <EditorEmptyState />;
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* `transform-gpu` (translateZ(0)) is a no-op visually, but it makes
          this the containing block for any `position: fixed` descendant —
          FootnotesNodeView uses that to pin the footnotes panel to the
          bottom of *this column* instead of the whole viewport, without any
          JS measurement, and without ever detaching from the ProseMirror
          contentEditable tree (portaling it out, an earlier version of
          this, broke editing entirely). It has to live on a DIFFERENT
          element than the one that scrolls: an element that both creates a
          fixed-position containing block AND clips overflow clips its own
          fixed descendants too, which just made the panel disappear/collapse
          into the flow instead of staying pinned. */}
      <div className="flex min-w-0 flex-1 flex-col transform-gpu">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AnvilEditor key={`${documentId}-${restoreNonce}`} documentId={documentId} />
        </div>
      </div>
      <RightPanel documentId={documentId} />
    </div>
  );
}
