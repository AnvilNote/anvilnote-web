"use client";

import { useEffect, useReducer, useRef } from "react";
import { useTranslations } from "next-intl";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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

// Press-and-hold auto-repeat for the -/+ stepper buttons: single click
// still fires once immediately, but holding down keeps stepping after a
// short delay (so a quick tap doesn't also trigger a repeat) until
// release. `onStep` is read fresh on every tick via the caller's own
// closure — this hook doesn't cache or clamp the value itself.
function useHoldRepeat(onStep: () => void) {
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  };

  const start = () => {
    onStepRef.current();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => onStepRef.current(), 80);
    }, 400);
  };

  useEffect(() => stop, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
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
  const writtenMode = normalizeWrittenMode(node.attrs.writtenMode);
  const writtenLines: number = typeof node.attrs.writtenLines === "number" ? node.attrs.writtenLines : 3;
  const writtenHeightPercent: number =
    typeof node.attrs.writtenHeightPercent === "number" ? node.attrs.writtenHeightPercent : 20;
  const multiForceOneColumn: boolean = node.attrs.multiForceOneColumn !== false;

  const writtenLinesRef = useRef(writtenLines);
  writtenLinesRef.current = writtenLines;
  const decrementLines = useHoldRepeat(() =>
    updateAttributes({ writtenLines: Math.max(1, writtenLinesRef.current - 1) }),
  );
  const incrementLines = useHoldRepeat(() =>
    updateAttributes({ writtenLines: writtenLinesRef.current + 1 }),
  );

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

  // Switching kind is a structural action (not gated behind an edit
  // toggle — always available). multi -> single: removes the LAST
  // choiceItem, parking its full ProseMirror JSON in stashedChoiceJSON
  // (not just text — v3 choices can be images/equations, a plain string
  // can't hold that). single -> multi: restores the parked node (or
  // appends a fresh empty-paragraph choiceItem if nothing's parked).
  // Switching to/from "written" adds/removes the ENTIRE choiceList child
  // (written items have no choices at all) — the choiceList itself, not
  // just its item count, changes.
  function handleKindChange(nextKind: QuestionKind) {
    const pos = getPos();
    if (pos === undefined) return;
    const thisNode = editor.state.doc.nodeAt(pos);
    if (!thisNode) return;

    if (kind === "written" && nextKind !== "written") {
      // Append a fresh choiceList (default count for nextKind) after the body.
      const insertPos = pos + thisNode.nodeSize - 1;
      const count = nextKind === "multi" ? 5 : 4;
      editor
        .chain()
        .focus()
        .insertContentAt(insertPos, {
          type: "choiceList",
          content: Array.from({ length: count }, () => ({
            type: "choiceItem",
            content: [{ type: "paragraph" }],
          })),
        })
        .updateAttributes("questionItem", { kind: nextKind })
        .run();
      return;
    }

    if (kind !== "written" && nextKind === "written") {
      // Remove the entire choiceList child.
      let choiceListPos: number | null = null;
      let choiceListNode: PMNode | null = null;
      thisNode.forEach((child, offset) => {
        if (child.type.name === "choiceList") {
          choiceListPos = pos + 1 + offset;
          choiceListNode = child;
        }
      });
      if (choiceListPos !== null && choiceListNode !== null) {
        const from = choiceListPos;
        const to = choiceListPos + (choiceListNode as PMNode).nodeSize;
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.delete(from, to);
            return true;
          })
          .updateAttributes("questionItem", { kind: nextKind })
          .run();
      } else {
        editor.chain().focus().updateAttributes("questionItem", { kind: nextKind }).run();
      }
      return;
    }

    if (kind === "multi" && nextKind === "single") {
      let choiceListNode: PMNode | null = null;
      let choiceListPos: number | null = null;
      thisNode.forEach((child, offset) => {
        if (child.type.name === "choiceList") {
          choiceListNode = child;
          choiceListPos = pos + 1 + offset;
        }
      });
      if (choiceListNode === null || choiceListPos === null || (choiceListNode as PMNode).childCount === 0) {
        editor.chain().focus().updateAttributes("questionItem", { kind: nextKind }).run();
        return;
      }
      const list = choiceListNode as PMNode;
      const lastChild = list.child(list.childCount - 1);
      const stashedChoiceJSON = JSON.stringify(lastChild.toJSON());
      let lastChildStart = (choiceListPos as number) + 1;
      for (let i = 0; i < list.childCount - 1; i++) lastChildStart += list.child(i).nodeSize;
      const lastChildEnd = lastChildStart + lastChild.nodeSize;
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.delete(lastChildStart, lastChildEnd);
          return true;
        })
        .updateAttributes("questionItem", { kind: nextKind, stashedChoiceJSON })
        .run();
      return;
    }

    if (kind === "single" && nextKind === "multi") {
      const stashedRaw = typeof node.attrs.stashedChoiceJSON === "string" ? node.attrs.stashedChoiceJSON : null;
      let choiceListPos: number | null = null;
      let choiceListNode: PMNode | null = null;
      thisNode.forEach((child, offset) => {
        if (child.type.name === "choiceList") {
          choiceListNode = child;
          choiceListPos = pos + 1 + offset;
        }
      });
      if (choiceListNode === null || choiceListPos === null) {
        editor.chain().focus().updateAttributes("questionItem", { kind: nextKind }).run();
        return;
      }
      const list = choiceListNode as PMNode;
      const insertPos = (choiceListPos as number) + list.nodeSize - 1;
      const newItemJSON = stashedRaw
        ? JSON.parse(stashedRaw)
        : { type: "choiceItem", content: [{ type: "paragraph" }] };
      editor
        .chain()
        .focus()
        .insertContentAt(insertPos, newItemJSON)
        .updateAttributes("questionItem", { kind: nextKind, stashedChoiceJSON: null })
        .run();
      return;
    }

    // multi -> multi / single -> single (shouldn't happen via the kind
    // menu, which only offers the 3 kinds — defensive fallback).
    editor.chain().focus().updateAttributes("questionItem", { kind: nextKind }).run();
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

  return (
    <NodeViewWrapper
      className="anvil-question-item relative grid grid-cols-[1.8em_1fr] items-baseline gap-x-[1em] gap-y-1"
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
      {/* text-right — the number sits inside a fixed 1.8em column
          (grid-cols-[1.8em_1fr]); right-aligning it within that column
          nudges it closer to the body without moving the body's own
          start position (column 2's left edge, i.e. gap-x-[1em] away
          from the number, is untouched either way). */}
      <span className="text-right font-medium" contentEditable={false}>
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

        {kind === "written" ? (
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
                  {...decrementLines}
                  className="flex size-6 items-center justify-center rounded text-muted-foreground/60 hover:bg-accent"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-6 text-center text-sm">{writtenLines}</span>
                <button
                  type="button"
                  {...incrementLines}
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
                className="relative"
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
        ) : null}
      </div>

      <div
        className="col-span-2 mt-1 flex items-center justify-end gap-1"
        contentEditable={false}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {kind === "multi" ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch
              checked={multiForceOneColumn}
              onCheckedChange={(checked) => updateAttributes({ multiForceOneColumn: checked })}
            />
            {tq(multiForceOneColumn ? "multiLayout.oneColumn" : "multiLayout.auto")}
          </label>
        ) : null}
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
