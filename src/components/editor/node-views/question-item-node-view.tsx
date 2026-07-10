"use client";

import { useEffect, useReducer, useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { choiceColumns } from "@/lib/question-choices";
import { QuestionKindMenu } from "@/components/editor/question-kind-menu";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";
import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/templates";
import {
  WRITTEN_MODES,
  normalizeQuestionKind,
  normalizeWrittenMode,
  defaultChoiceCount,
  type QuestionKind,
  type WrittenMode,
} from "@/lib/question-kinds";

const GRID_COLS_CLASS: Record<1 | 2 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  4: "grid-cols-4",
};

const CHOICE_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// Same live-counted numbering as v1, now counting "questionItem" nodes
// (was: "question" nodes) — see this feature's design doc for why the
// count moved down a level when `question` became a pure container.
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
    if (n.type.name === "questionItem") count += 1;
  });
  return count + 1;
}

// Rough in-editor visual proxy for the written-blank area's height — NOT
// a claim of matching the eventual PDF page-relative height pixel for
// pixel, just enough to see the box grow/shrink as the percent changes.
// See this feature's design doc: the PDF's real height comes from
// writtenHeightCm (baked from percent x the template's textHeightCm at
// the moment the percent was last edited — see question.ts's
// itemAttrsForKind/the percent-change handler below), not from this.
const BLANK_PREVIEW_PX_PER_PERCENT = 3;

export function QuestionItemNodeView({
  node,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
}: NodeViewProps) {
  const tq = useTranslations("editor.questionBlock");
  const number = useQuestionNumber(editor, getPos);

  const kind = normalizeQuestionKind(node.attrs.kind);
  const choices: string[] = Array.isArray(node.attrs.choices) ? node.attrs.choices : [];
  const writtenMode = normalizeWrittenMode(node.attrs.writtenMode);
  const writtenLines: number = typeof node.attrs.writtenLines === "number" ? node.attrs.writtenLines : 3;
  const writtenHeightPercent: number =
    typeof node.attrs.writtenHeightPercent === "number" ? node.attrs.writtenHeightPercent : 20;

  // Same activeDocument -> templateId -> activeTemplate lookup as
  // stats-chart-dialog.tsx's own textWidthCm resolution — falls back to
  // DEFAULT_TEMPLATE_ID if no document is active yet.
  const activeDocumentId = useDocumentStore((s) => s.activeId);
  const activeDocument = useDocumentStore((s) => s.documents.find((d) => d.id === activeDocumentId));
  const activeTemplate = useTemplatesStore((s) =>
    s.getTemplate(activeDocument?.templateId ?? DEFAULT_TEMPLATE_ID),
  );
  const textHeightCm = activeTemplate?.textHeightCm ?? null;

  function resolveWrittenHeightCm(percent: number): number | null {
    return textHeightCm != null ? Math.round(((percent / 100) * textHeightCm) * 100) / 100 : null;
  }

  const [editingChoices, setEditingChoices] = useState(false);
  const [draft, setDraft] = useState<string[]>(choices);

  function startEditingChoices() {
    setDraft(choices);
    setEditingChoices(true);
  }

  function commitChoices() {
    updateAttributes({ choices: draft });
    setEditingChoices(false);
  }

  // Switching kind is a structural action (not gated behind an edit
  // toggle — always available). Per this feature's design doc: switching
  // TO "multi" tops the choices array up to 5 entries ONLY if it's still
  // exactly the untouched 4-empty-string "single" default — real
  // user-entered content is never clobbered. Switching to/from "written"
  // leaves `choices` attrs untouched (just unused while kind is
  // "written"), so switching back restores whatever was there.
  function handleKindChange(nextKind: QuestionKind) {
    const isDefaultSingleChoices =
      choices.length === 4 && choices.every((c) => c === "");
    const nextChoices =
      nextKind === "multi" && isDefaultSingleChoices
        ? Array.from({ length: defaultChoiceCount("multi") }, () => "")
        : choices;
    updateAttributes({ kind: nextKind, choices: nextChoices });
  }

  function handleWrittenModeChange(nextMode: WrittenMode) {
    updateAttributes({ writtenMode: nextMode });
  }

  // Percent -> cm conversion happens HERE, at the moment the user edits
  // the percent, using whatever template context is available — see
  // Task 9 for where activeTemplate/textHeightCm actually comes from
  // (useTemplatesStore, same source as stats-chart-dialog.tsx's own
  // textWidthCm lookup). This node view itself doesn't own that lookup;
  // it receives a resolver function as a prop from... actually per this
  // plan's Task 9, the conversion is done via a small hook defined
  // in-file here (see below) so this component stays self-contained.
  function handleWrittenHeightPercentChange(nextPercent: number) {
    updateAttributes({
      writtenHeightPercent: nextPercent,
      writtenHeightCm: resolveWrittenHeightCm(nextPercent),
    });
  }

  // question.ts's schema requires "questionItem+" (at least one child) on
  // the container — deleting the last remaining item via this button
  // must remove the whole container instead of leaving a 0-child
  // "question" node behind (ProseMirror does not auto-prune an empty
  // required-content parent on its own; ContentMatch-based schemas like
  // this one just count on callers never producing an invalid doc).
  function handleDelete() {
    const pos = getPos();
    if (pos === undefined) {
      deleteNode();
      return;
    }
    const $pos = editor.state.doc.resolve(pos);
    const parent = $pos.parent;
    if (parent.type.name === "question" && parent.childCount === 1) {
      const parentPos = $pos.before($pos.depth);
      editor
        .chain()
        .command(({ tr }) => {
          tr.delete(parentPos, parentPos + parent.nodeSize);
          return true;
        })
        .run();
      return;
    }
    deleteNode();
  }

  const columns = choiceColumns(choices);

  return (
    <NodeViewWrapper
      className="anvil-question-item relative grid grid-cols-[1.8em_1fr] gap-x-2 gap-y-1 py-1.5"
      data-type="question-item"
    >
      <span className="pt-0.5 font-medium" contentEditable={false}>
        {number}.
      </span>

      <div>
        <NodeViewContent className="[&>*:first-child]:mt-0" />

        {kind !== "written" ? (
          editingChoices ? (
            <div className="mt-1.5 flex flex-col gap-1.5" contentEditable={false}>
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
              className={`mt-1.5 grid gap-x-4 gap-y-1.5 ${GRID_COLS_CLASS[columns]}`}
              contentEditable={false}
            >
              {choices.map((choice, index) => (
                <div key={index} className="text-sm">
                  ({CHOICE_LABELS[index] ?? index + 1}) {choice}
                </div>
              ))}
            </div>
          ) : null
        ) : (
          <div className="mt-1.5 flex flex-col gap-2" contentEditable={false}>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {WRITTEN_MODES.map((mode) => (
                <label key={mode} className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={writtenMode === mode}
                    onChange={() => handleWrittenModeChange(mode)}
                  />
                  {tq(`writtenModes.${mode}`)}
                </label>
              ))}
            </div>
            {writtenMode === "lines" ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateAttributes({ writtenLines: Math.max(1, writtenLines - 1) })}
                  className="flex size-6 items-center justify-center rounded text-muted-foreground/60 hover:bg-accent"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-6 text-center text-sm">{writtenLines}</span>
                <button
                  type="button"
                  onClick={() => updateAttributes({ writtenLines: writtenLines + 1 })}
                  className="flex size-6 items-center justify-center rounded text-muted-foreground/60 hover:bg-accent"
                >
                  <Plus className="size-3.5" />
                </button>
                <div className="ml-2 flex-1 border-t border-dashed" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={writtenHeightPercent}
                  onChange={(event) => handleWrittenHeightPercentChange(Number(event.target.value))}
                  className="w-16 rounded border bg-transparent px-2 py-1 text-sm"
                />
                <span className="text-xs text-muted-foreground">%</span>
                <div
                  className="flex-1 rounded border border-dashed"
                  style={{ height: `${writtenHeightPercent * BLANK_PREVIEW_PX_PER_PERCENT}px` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className="col-span-2 mt-1 flex items-center justify-end gap-1"
        contentEditable={false}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <QuestionKindMenu
          onSelect={handleKindChange}
          trigger={
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
            >
              {tq(`kinds.${kind}`)}
            </button>
          }
        />
        {kind !== "written" ? (
          <button
            type="button"
            aria-label={editingChoices ? tq("done") : tq("edit")}
            title={editingChoices ? tq("done") : tq("edit")}
            onClick={editingChoices ? commitChoices : startEditingChoices}
            className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            {editingChoices ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
          </button>
        ) : null}
        <button
          type="button"
          aria-label={tq("removeQuestion")}
          title={tq("removeQuestion")}
          onClick={handleDelete}
          className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}
