"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ImagePlus, Sigma, Trash2, Type } from "lucide-react";
import { pickAndInsertImageAt } from "@/lib/tiptap/image";
import { isValidLatex, renderMathPreview } from "@/lib/tiptap/math";

const CHOICE_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// Renders a single choice: (label) content, same 2-column grid pattern
// question-item-node-view.tsx itself uses for number+body — chosen
// specifically because content here can be a block-level image or
// blockMath equation (not inline text), so a plain "(A) " text-prefix
// trick can't keep the label glued to non-text content on the same
// visual row; a grid keeps the label pinned to column 1 regardless of
// what column 2 holds.
export function ChoiceItemNodeView({ node, editor, getPos, deleteNode }: NodeViewProps) {
  const t = useTranslations("editor.questionBlock");
  const [mathDraft, setMathDraft] = useState("");
  const [showMathInput, setShowMathInput] = useState(false);

  // Index within the parent choiceList, for the (A)/(B)/... label —
  // same "count preceding siblings" pattern useQuestionNumber uses,
  // just scoped to this node's own immediate parent instead of the
  // whole document.
  const pos = getPos();
  let index = 0;
  if (pos !== undefined) {
    const $pos = editor.state.doc.resolve(pos);
    const parent = $pos.parent;
    if (parent.type.name === "choiceList") {
      index = $pos.index();
    }
  }
  const label = CHOICE_LABELS[index] ?? String(index + 1);

  const contentType = node.content.firstChild?.type.name ?? "paragraph";

  function replaceContentWith(newContentJSON: Record<string, unknown>) {
    if (pos === undefined) return;
    const from = pos + 1;
    const to = pos + node.nodeSize - 1;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.replaceWith(from, to, editor.schema.nodeFromJSON(newContentJSON));
        return true;
      })
      .run();
  }

  function switchToText() {
    setShowMathInput(false);
    replaceContentWith({ type: "paragraph" });
  }

  function switchToImage() {
    if (pos === undefined) return;
    setShowMathInput(false);
    pickAndInsertImageAt(editor, pos + 1, pos + node.nodeSize - 1);
  }

  function confirmMath() {
    if (!isValidLatex(mathDraft)) return;
    replaceContentWith({ type: "blockMath", attrs: { latex: mathDraft } });
    setShowMathInput(false);
    setMathDraft("");
  }

  const mathPreview =
    mathDraft && isValidLatex(mathDraft) ? renderMathPreview(mathDraft, true) : null;

  return (
    <NodeViewWrapper
      className="anvil-choice-item relative grid grid-cols-[1.8em_1fr] items-start gap-x-[0.5em]"
      data-type="choice-item"
    >
      <span className="text-right" contentEditable={false}>
        ({label})
      </span>

      <div className="relative">
        <NodeViewContent
          className={contentType === "image" ? "anvil-choice-item__image" : undefined}
        />

        {showMathInput ? (
          <div className="mt-1 flex flex-col gap-1" contentEditable={false}>
            <input
              type="text"
              value={mathDraft}
              onChange={(event) => setMathDraft(event.target.value)}
              placeholder="x^2 + 1"
              className="rounded border bg-transparent px-2 py-1 font-mono text-sm"
            />
            {mathPreview?.ok ? (
              <div dangerouslySetInnerHTML={{ __html: mathPreview.html }} />
            ) : null}
            <button type="button" onClick={confirmMath} className="w-fit text-xs underline">
              {t("done")}
            </button>
          </div>
        ) : null}

        <div
          className="mt-1 flex items-center gap-1"
          contentEditable={false}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label="text"
            onClick={switchToText}
            className={`flex size-5 items-center justify-center rounded ${contentType === "paragraph" ? "bg-accent" : "text-muted-foreground/60 hover:bg-accent"}`}
          >
            <Type className="size-3" />
          </button>
          <button
            type="button"
            aria-label="image"
            onClick={switchToImage}
            className={`flex size-5 items-center justify-center rounded ${contentType === "image" ? "bg-accent" : "text-muted-foreground/60 hover:bg-accent"}`}
          >
            <ImagePlus className="size-3" />
          </button>
          <button
            type="button"
            aria-label="equation"
            onClick={() => setShowMathInput(true)}
            className={`flex size-5 items-center justify-center rounded ${contentType === "blockMath" ? "bg-accent" : "text-muted-foreground/60 hover:bg-accent"}`}
          >
            <Sigma className="size-3" />
          </button>
          <button
            type="button"
            aria-label={t("removeChoice")}
            title={t("removeChoice")}
            onClick={deleteNode}
            className="flex size-5 items-center justify-center rounded text-muted-foreground/60 hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
