"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { buildExtensions } from "@/lib/tiptap/extensions";

// A read-only render of a document snapshot, reusing the exact same
// extension set as the real editor (tiptap-editor.tsx) — not a simplified
// text/HTML dump — so math actually renders through KaTeX, callouts keep
// their styling, images display, and tables format correctly, instead of
// showing raw unprocessed node placeholders the way a static
// generateHTML()-based preview would for anything backed by a NodeView.
// `editable: false` disables typing/selection-driven UI (drag handles,
// bubble menu, etc. simply aren't mounted here at all) while NodeView
// rendering itself works identically to the live editor.
export function VersionPreview({ content }: { content: JSONContent }) {
  const t = useTranslations("editor");

  const extensions = useMemo(
    () =>
      buildExtensions({
        placeholder: "",
        figureLabel: t("image.figure"),
        tableLabel: t("table.figure"),
        figureCaptionPlaceholder: t("image.captionPlaceholder"),
        tableCaptionPlaceholder: t("table.captionPlaceholder"),
        tableDeleteLabel: t("block.delete", { type: t("block.types.table") }),
        tableAddRowLabel: t("table.addRow"),
        tableAddColumnLabel: t("table.addColumn"),
        tableResizeRowLabel: t("table.resizeRow"),
        tableResizeColumnLabel: t("table.resizeColumn"),
        questionBodyPlaceholder: "",
        choicePlaceholder: () => "",
        tableHeaderPlaceholder: "",
        tableCellPlaceholder: "",
        onMathClick: () => {},
      }),
    [t],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions,
    content,
    editorProps: {
      attributes: { class: "anvil-prose" },
    },
  });

  return <EditorContent editor={editor} />;
}
