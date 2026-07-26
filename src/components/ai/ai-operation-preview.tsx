"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { buildExtensions } from "@/lib/tiptap/extensions";
import type { OperationPreviewCard, OperationPreviewModel } from "@/lib/ai/document/operation-preview";

// --- Architecture decision (Task 24.2) ------------------------------------
//
// Every before/after fragment renders through a REAL, detached, read-only
// Tiptap `Editor` built from the exact same `buildExtensions()` schema the
// live editor uses — never a hand-rolled second React renderer for
// mermaid/functionPlot/statsChart/table/callout/proof/question/footnote —
// so Mermaid/FunctionPlot/StatsChart draw from their own real NodeViews
// (trusted, semantic-attrs-only rendering) and every other structural node
// type gets correct visuals for free, automatically staying in sync with
// the live editor's own rendering as those NodeViews evolve.
//
// This is NOT the first such instance in this codebase, contrary to this
// task's own brief (which only checked for a raw `new Editor(...)` in
// production code): `components/app/version-preview.tsx` already ships a
// production, read-only, full-fidelity document preview built on the exact
// same `buildExtensions()` + `editable:false` + `useEditor`/`EditorContent`
// pattern this file reuses. That precedent is followed here rather than
// hand-building a parallel raw-`Editor` construction path.
//
// One editor instance per rendered fragment SLOT (a card's own "before" and
// "after" each get their own), never one instance shared and reused across
// cards: every card in an edit-operations draft is visible simultaneously
// in the same scrollable panel (unlike, say, a "one version open at a
// time" dialog), so each slot's DOM output has to exist at the same time as
// every other slot's. Cleanup is entirely delegated to `useEditor`'s own
// hook lifecycle (it destroys its underlying Editor on unmount) — the same
// trust VersionPreview already places in it, so no extra destroy effect is
// written here.
//
// Known, documented limitation: none of the real NodeViews this reuses
// (mermaid/table/callout/proof/...) conditionally hide their own editing
// chrome (mode toggles, delete buttons, table gutter buttons, color
// pickers, ...) just because the host editor is `editable:false` —
// VersionPreview has this exact same property today for whole-document
// previews. Stripping that chrome per node type would mean touching each
// of those ~15 NodeView components individually, which is out of scope for
// a preview-only task. It is purely visual: every instance here is fully
// detached, so nothing renderable in this component can ever mutate the
// live editor or the caller's document.
function useReadOnlyPreviewExtensions() {
  const t = useTranslations("editor");
  return useMemo(
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
}

// Defense in depth, independent of operation-preview.ts's own guarantee
// (which already forces `svg: null` for every functionPlot/statsChart
// fragment it builds — see its header comment): function-plot-node-view.tsx
// and stats-chart-node-view.tsx both render a CACHED `attrs.svg` string via
// `dangerouslySetInnerHTML` whenever it is present, only ever falling back
// to recomputing a real SVG from semantic attrs when it is missing/null.
// That caching exists for the LIVE editor's own performance, not as a
// trust boundary — nothing about it screens for "did a model write this."
// Recursively nulling `attrs.svg` right here, at the point this component
// hands content to a real Editor, means this preview never depends on
// every upstream caller (today's operation-preview.ts, or a future one)
// remembering to do the same.
function stripUntrustedSvgAttrs(node: JSONContent): JSONContent {
  const content = node.content?.map(stripUntrustedSvgAttrs);
  const attrs = node.attrs && "svg" in node.attrs ? { ...node.attrs, svg: null } : node.attrs;
  return { ...node, ...(attrs ? { attrs } : {}), ...(content ? { content } : {}) };
}

function FragmentPreview({ content }: { content: JSONContent | null }) {
  const tSmart = useTranslations("ai");
  const extensions = useReadOnlyPreviewExtensions();
  const sanitized = useMemo(() => (content ? stripUntrustedSvgAttrs(content) : null), [content]);
  // Always call useEditor (rules of hooks) — an empty placeholder document
  // is used as the editor's own content whenever there is nothing to show,
  // and the placeholder text is rendered instead of the editor in that case.
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions,
    content: sanitized ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: { attributes: { class: "anvil-prose" } },
  });

  if (!content) {
    return <p className="text-xs italic text-muted-foreground">{tSmart("smart.emptyFragment")}</p>;
  }
  return <EditorContent editor={editor} />;
}

function mergeCardFragments(
  cards: readonly OperationPreviewCard[],
  side: "before" | "after",
): JSONContent | null {
  const content = cards.flatMap((card) => {
    const fragment = card[side];
    if (!fragment) return [];
    if (fragment.type === "doc") return fragment.content ?? [];
    return [fragment];
  });
  return content.length ? { type: "doc", content } : null;
}

function OperationBatchCard({ cards }: { cards: readonly OperationPreviewCard[] }) {
  const tSmart = useTranslations("ai");
  const before = useMemo(() => mergeCardFragments(cards, "before"), [cards]);
  const after = useMemo(() => mergeCardFragments(cards, "after"), [cards]);
  return (
    <article
      data-testid="ai-operation-card"
      className="overflow-hidden rounded-xl border border-border/80 bg-background"
    >
      <div className="flex items-center gap-2 border-b bg-muted/35 px-3 py-1.5 text-xs">
        <span className="font-medium">{tSmart("smart.changeSummary")}</span>
      </div>
      <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="max-h-40 overflow-y-auto p-2">
          <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
            {tSmart("smart.before")}
          </p>
          <FragmentPreview content={before} />
        </div>
        <div className="max-h-40 overflow-y-auto p-2">
          <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
            {tSmart("smart.after")}
          </p>
          <FragmentPreview content={after} />
        </div>
      </div>
    </article>
  );
}

// Renders one coherent before/after preview for the full ordered batch.
// Individual operation cards are intentionally merged here: operation
// boundaries are an implementation detail, while Accept/Reject still act
// atomically on the verified batch.
export function AiOperationPreview({
  model,
  disabled,
  onAccept,
  onReject,
}: {
  model: OperationPreviewModel;
  disabled: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const tSmart = useTranslations("ai");
  return (
    <div className="mt-2 space-y-2">
      <OperationBatchCard cards={model.cards} />
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" disabled={disabled} onClick={onReject}>
          {tSmart("smart.reject")}
        </Button>
        <Button size="sm" disabled={disabled} onClick={onAccept}>
          {tSmart("smart.accept")}
        </Button>
      </div>
    </div>
  );
}
