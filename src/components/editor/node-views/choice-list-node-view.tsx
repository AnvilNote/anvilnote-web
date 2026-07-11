"use client";

import { useEffect, useReducer } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { choiceColumns, type ChoiceEntry } from "@/lib/question-choices";

// choiceColumns() can now return any of 1-5 (min(entryCount, tierCap), not
// just the old fixed 1/2/4) — literal class names so Tailwind's static
// scanner keeps all five in the build, not a template-literal-constructed
// class name (which Tailwind can't see/wouldn't generate).
const GRID_COLS_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
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
  // Real bug, caught via a live repro: toggling the PARENT questionItem's
  // multiForceOneColumn attr (a sibling control, not this node's own
  // content) didn't re-render this NodeView at all — the layout stayed
  // frozen at whatever it was when this component last happened to
  // render on its own, same stale-NodeView pattern this session's other
  // NodeViews (useQuestionNumber, choice-item-node-view.tsx's label
  // index) already had to work around. Subscribing to editor "update"
  // keeps the column count current.
  const [, forceRerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const onUpdate = () => forceRerender();
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor]);

  const entries: ChoiceEntry[] = [];
  node.forEach((choiceItem) => {
    const inner = choiceItem.content.firstChild;
    if (inner) entries.push(entryForChild(inner));
  });

  // Multi-choice defaults to one option per line (multiForceOneColumn,
  // default true — preserves the original always-forced behavior for
  // existing documents), but can be switched to the SAME 4/2/1 auto-
  // column heuristic single-choice uses via a toggle next to the kind
  // menu (question-item-node-view.tsx). This NodeView doesn't own `kind`
  // itself (that's a questionItem attr, one level up) — resolve the
  // parent node via getPos(), same "look at the resolved position's
  // parent" pattern choice-item-node-view.tsx uses for its own label index.
  let forcedOneColumn = false;
  const pos = getPos();
  if (pos !== undefined) {
    const $pos = editor.state.doc.resolve(pos);
    const parent = $pos.parent;
    if (
      parent.type.name === "questionItem" &&
      parent.attrs.kind === "multi" &&
      parent.attrs.multiForceOneColumn !== false
    ) {
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
