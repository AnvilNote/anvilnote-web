"use client";

import { useEffect, useReducer, useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { choiceColumns } from "@/lib/question-choices";
import { QuestionKindMenu } from "@/components/editor/question-kind-menu";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";
import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/templates";
import {
  normalizeQuestionKind,
  normalizeWrittenMode,
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
  // multi -> single parks the LAST choice in stashedChoice instead of
  // discarding it; single -> multi restores that parked value (or
  // appends "" if nothing's parked — e.g. a fresh single that was never
  // multi before). Only single<->multi transitions touch choices/stash
  // at all; switching to/from "written" leaves both alone so switching
  // back later restores whatever was there.
  function handleKindChange(nextKind: QuestionKind) {
    if (kind === "multi" && nextKind === "single" && choices.length > 0) {
      const stashed = choices[choices.length - 1];
      updateAttributes({
        kind: nextKind,
        choices: choices.slice(0, -1),
        stashedChoice: stashed,
      });
      return;
    }
    if (kind === "single" && nextKind === "multi") {
      const stashedChoice = typeof node.attrs.stashedChoice === "string" ? node.attrs.stashedChoice : "";
      updateAttributes({
        kind: nextKind,
        choices: [...choices, stashedChoice],
        stashedChoice: null,
      });
      return;
    }
    updateAttributes({ kind: nextKind });
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

  // Multi-choice always renders one option per line — per explicit
  // feedback, the 4/2/1 auto-column heuristic is single-choice only.
  const columns = kind === "multi" ? 1 : choiceColumns(choices);

  return (
    <NodeViewWrapper
      className="anvil-question-item relative grid grid-cols-[1.8em_1fr] items-baseline gap-x-[1.2em] gap-y-1 py-1.5"
      data-type="question-item"
    >
      {/* items-baseline, not items-start/align-top — a plain top-alignment
          left the number visually higher than a CJK body's first line even
          though both boxes shared the exact same computed top/line-height
          (confirmed via getBoundingClientRect + getComputedStyle: 0px
          diff). Root cause: "1." renders in the Latin font (Geist) while
          "你好" falls back to the system's CJK font — different glyph
          ascent/descent metrics within the SAME line-height box produce a
          few px of visual offset that top-alignment can't see or fix,
          confirmed by comparing against Tiptap's own native <ol><li>
          numbering (which uses the browser's built-in ::marker baseline
          alignment and shows no such offset for identical text).
          items-baseline aligns this span to the body's actual first-line
          text baseline instead of the box's top edge, matching that
          native behavior regardless of script. No more pt-0.5 nudge
          needed once the alignment is baseline-based. */}
      <span className="font-medium" contentEditable={false}>
        {number}.
      </span>

      <div>
        {/* anvil-question-item__body, not a Tailwind [&>*:first-child]:mt-0
            arbitrary variant — that was tried first and had ZERO effect:
            globals.css's ".ProseMirror p { margin: 0.65rem 0; }" rule
            sits OUTSIDE any @layer block (plain/unlayered CSS), and CSS
            cascade layers always let an unlayered rule win over ANY
            layered rule (Tailwind v4's utilities included), regardless
            of specificity. Confirmed via a live pixel measurement
            (getBoundingClientRect + getComputedStyle) showing the
            paragraph's real margin-top was still 0.65rem, offsetting the
            body's first line 10.4px below the number span it's supposed
            to align with. The matching plain/unlayered override rule
            lives in globals.css right next to .ProseMirror p itself. */}
        <NodeViewContent className="anvil-question-item__body" />

        {kind !== "written" ? (
          editingChoices ? (
            <div className="mt-1.5 flex flex-col gap-[0.8em]" contentEditable={false}>
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
              className={`mt-1.5 grid gap-x-4 gap-y-[0.8em] ${GRID_COLS_CLASS[columns]}`}
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
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={writtenMode === "blank"}
                onCheckedChange={(checked) => handleWrittenModeChange(checked ? "blank" : "lines")}
              />
              {tq(`writtenModes.${writtenMode}`)}
            </label>
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
              // Percent input sits INSIDE the simulated blank box's own
              // top-right corner (absolute, relative to this wrapper) —
              // per explicit feedback, not as a separate control beside
              // the box.
              <div
                className="relative rounded border border-dashed"
                style={{ height: `${writtenHeightPercent * BLANK_PREVIEW_PX_PER_PERCENT}px` }}
              >
                <div className="absolute top-1 right-1 flex items-center gap-1">
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={writtenHeightPercent}
                    onChange={(event) => handleWrittenHeightPercentChange(Number(event.target.value))}
                    className="w-14 rounded border bg-background px-1.5 py-0.5 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
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
