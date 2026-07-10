"use client";

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { choiceColumns, type ChoiceEntry } from "@/lib/question-choices";

const GRID_COLS_CLASS: Record<1 | 2 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  4: "grid-cols-4",
};

function entryForChild(child: { type: { name: string }; textContent: string }): ChoiceEntry {
  if (child.type.name !== "paragraph") {
    // A choiceItem's content is "paragraph | image | blockMath" — but
    // this function receives the choiceItem's CHILD directly (the
    // actual paragraph/image/blockMath), not the choiceItem wrapper
    // itself. Callers pass node.content.firstChild per choiceItem.
    return child.type.name === "image" ? { kind: "image" } : { kind: "blockMath" };
  }
  return { kind: "text", text: child.textContent };
}

// This is where the auto 1/2/4-column layout decision actually happens
// (moved out of question-item-node-view.tsx, which used to compute it
// directly against the old choices:string[] attribute) — it inspects
// its own choiceItem children's content types/text to compute columns
// via question-choices.ts's typed-entry choiceColumns.
export function ChoiceListNodeView({ node, editor, getPos }: NodeViewProps) {
  const entries: ChoiceEntry[] = [];
  node.forEach((choiceItem) => {
    const inner = choiceItem.content.firstChild;
    if (inner) entries.push(entryForChild(inner));
  });

  // Multi-choice always renders one option per line — per explicit
  // product decision carried over from the old choices:string[] shape's
  // question-item-node-view.tsx, the 4/2/1 auto-column heuristic is
  // single-choice only. This NodeView doesn't own `kind` itself (that's
  // a questionItem attr, one level up) — resolve the parent node's kind
  // via getPos(), same "look at the resolved position's parent" pattern
  // choice-item-node-view.tsx uses for its own label index.
  let forcedOneColumn = false;
  const pos = getPos();
  if (pos !== undefined) {
    const $pos = editor.state.doc.resolve(pos);
    const parent = $pos.parent;
    if (parent.type.name === "questionItem" && parent.attrs.kind === "multi") {
      forcedOneColumn = true;
    }
  }

  const columns = forcedOneColumn ? 1 : choiceColumns(entries);

  return (
    <NodeViewWrapper
      className={`anvil-choice-list mt-1.5 grid gap-x-4 gap-y-[0.8em] ${GRID_COLS_CLASS[columns]}`}
      data-type="choice-list"
    >
      <NodeViewContent className="contents" />
    </NodeViewWrapper>
  );
}
