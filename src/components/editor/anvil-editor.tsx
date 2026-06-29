"use client";

// AnvilEditor is the document editing surface. The name is kept (it's imported
// across the app), but the implementation is now Tiptap-based — BlockNote has
// been fully removed. The editor stores Tiptap JSON with inline/block math
// nodes carrying LaTeX source.
import { TiptapEditor } from "@/components/editor/tiptap-editor";

export function AnvilEditor({ documentId }: { documentId: string }) {
  return <TiptapEditor documentId={documentId} />;
}
