"use client";

import { useEffect, useReducer, useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { choiceColumns } from "@/lib/question-choices";

// Tailwind's JIT scanner needs literal class-name strings present in the
// source file — a template-interpolated "grid-cols-" + n string would be
// invisible to it and silently produce no grid at build time. This map is
// the fix: every possible class the component can emit is written out
// once, here.
const GRID_COLS_CLASS: Record<1 | 2 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  4: "grid-cols-4",
};

const CHOICE_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// Question numbering isn't stored on the node — it's derived live from
// this node's position among every other "question" node in the document,
// mirroring the reference Typst template's own q-num counter (increments
// per #question[...] call in document order — see
// templates/shared/anvil-question.typ in anvilnote-renderer). Recomputes
// on every editor transaction via editor.on("update") so inserting,
// deleting, or reordering questions renumbers automatically, with no
// explicit "renumber" step anywhere.
function useQuestionNumber(editor: NodeViewProps["editor"], getPos: NodeViewProps["getPos"]) {
  const [, forceRerender] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    const onUpdate = () => forceRerender();
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor]);

  const pos = getPos();
  if (pos === undefined) return 1;
  let count = 0;
  editor.state.doc.nodesBetween(0, pos, (n) => {
    if (n.type.name === "question") count += 1;
  });
  return count + 1;
}

// The question BODY (NodeViewContent) stays normal always-editable
// ProseMirror content, same as every other block node in this codebase —
// see this plan's "Design correction #2" note. The read/edit toggle here
// governs the CHOICES list only (a plain attrs array, not ProseMirror
// content, same shape as stats-chart-node-view.tsx's own `data` attr).
export function QuestionNodeView({
  node,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
}: NodeViewProps) {
  const t = useTranslations("editor.block");
  const tq = useTranslations("editor.questionBlock");
  const number = useQuestionNumber(editor, getPos);
  const choices: string[] = Array.isArray(node.attrs.choices) ? node.attrs.choices : [];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(choices);

  function startEditing() {
    setDraft(choices);
    setEditing(true);
  }

  function commit() {
    updateAttributes({ choices: draft });
    setEditing(false);
  }

  const columns = choiceColumns(choices);

  return (
    <NodeViewWrapper
      className="anvil-question group relative my-3 rounded border p-3 pr-8"
      data-type="question"
    >
      <div
        className="absolute top-1 left-1 hidden group-hover:flex"
        contentEditable={false}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={t("delete", { type: t("types.question") })}
          title={t("delete", { type: t("types.question") })}
          onClick={deleteNode}
          className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="flex gap-2">
        <span className="shrink-0 font-medium" contentEditable={false}>
          {number}.
        </span>
        <NodeViewContent className="flex-1" />
      </div>

      {editing ? (
        <div className="mt-2 flex flex-col gap-1.5" contentEditable={false}>
          {draft.map((choice, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className="w-6 shrink-0 text-sm text-muted-foreground">
                ({CHOICE_LABELS[index] ?? index + 1})
              </span>
              <input
                type="text"
                value={choice}
                onChange={(event) => {
                  const next = [...draft];
                  next[index] = event.target.value;
                  setDraft(next);
                }}
                className="flex-1 rounded border bg-transparent px-2 py-1 text-sm"
              />
              <button
                type="button"
                aria-label={tq("removeChoice")}
                title={tq("removeChoice")}
                onClick={() => setDraft(draft.filter((_, i) => i !== index))}
                className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/60 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDraft([...draft, ""])}
            className="flex w-fit items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-3.5" />
            {tq("addChoice")}
          </button>
        </div>
      ) : choices.length > 0 ? (
        <div
          className={`mt-2 grid gap-x-4 gap-y-1.5 ${GRID_COLS_CLASS[columns]}`}
          contentEditable={false}
        >
          {choices.map((choice, index) => (
            <div key={index} className="text-sm">
              ({CHOICE_LABELS[index] ?? index + 1}) {choice}
            </div>
          ))}
        </div>
      ) : null}

      <div
        className="absolute right-1 bottom-1"
        contentEditable={false}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={editing ? tq("done") : tq("edit")}
          title={editing ? tq("done") : tq("edit")}
          onClick={editing ? commit : startEditing}
          className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
        </button>
      </div>
    </NodeViewWrapper>
  );
}
