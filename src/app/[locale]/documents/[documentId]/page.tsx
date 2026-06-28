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
      <div className="min-w-0 flex-1 overflow-y-auto">
        <AnvilEditor key={documentId} documentId={documentId} />
      </div>
      <RightPanel documentId={documentId} />
    </div>
  );
}
