import type { Editor } from "@tiptap/core";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { QuestionNodeView } from "@/components/editor/node-views/question-node-view";
import { QuestionItemNodeView } from "@/components/editor/node-views/question-item-node-view";
import {
  type QuestionKind,
  DEFAULT_QUESTION_KIND,
  DEFAULT_WRITTEN_MODE,
  defaultChoiceCount,
  normalizeQuestionKind,
  normalizeWrittenMode,
} from "@/lib/question-kinds";

// Question block v2: `question` is a pure container (no attrs of its
// own — see this feature's design doc for why the v1 "one question per
// block" shape was replaced) holding one or more `questionItem` children,
// each independently numbered/typed/deletable. Modeled on the reference
// personal template's question()/choices() pair (see
// /Users/anthonysung/tutoring/english/quiz/quiz-template.typ) — this is
// the editor-side half; anvilnote-renderer's tiptap-to-typst.ts and
// anvilnote-docx-exporter's tiptap-to-pandoc-markdown.ts export it to
// PDF/Word, each with their own matching "container + item" restructure.
export const AnvilQuestion = Node.create({
  name: "question",
  group: "block",
  content: "questionItem+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="question"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "question" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuestionNodeView);
  },
});

// A single numbered sub-question inside a `question` container. `kind`
// drives which UI (and which PDF/Word output) the item gets: single/multi
// choice share the exact same choices[] shape and column-layout rendering
// (question-choices.ts) — visually identical per explicit product
// decision, only the DEFAULT choice count differs (4 vs 5, see
// defaultChoiceCount()). `written` has no choices; it has an answer-
// writing area instead (writtenMode/writtenLines/writtenHeightPercent/
// writtenHeightCm).
export const AnvilQuestionItem = Node.create({
  name: "questionItem",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      kind: {
        default: DEFAULT_QUESTION_KIND,
        parseHTML: (element) => normalizeQuestionKind(element.getAttribute("data-kind")),
        renderHTML: (attributes) => ({ "data-kind": normalizeQuestionKind(attributes.kind) }),
      },
      choices: {
        default: Array.from({ length: defaultChoiceCount(DEFAULT_QUESTION_KIND) }, () => ""),
        parseHTML: (element) => {
          try {
            const parsed = JSON.parse(element.getAttribute("data-choices") ?? "[]");
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-choices": JSON.stringify(attributes.choices ?? []),
        }),
      },
      writtenMode: {
        default: DEFAULT_WRITTEN_MODE,
        parseHTML: (element) => normalizeWrittenMode(element.getAttribute("data-written-mode")),
        renderHTML: (attributes) => ({
          "data-written-mode": normalizeWrittenMode(attributes.writtenMode),
        }),
      },
      writtenLines: {
        default: 3,
        parseHTML: (element) => {
          const raw = Number(element.getAttribute("data-written-lines"));
          return Number.isFinite(raw) && raw > 0 ? raw : 3;
        },
        renderHTML: (attributes) => ({
          "data-written-lines": String(attributes.writtenLines ?? 3),
        }),
      },
      writtenHeightPercent: {
        default: 20,
        parseHTML: (element) => {
          const raw = Number(element.getAttribute("data-written-height-percent"));
          return Number.isFinite(raw) && raw > 0 ? raw : 20;
        },
        renderHTML: (attributes) => ({
          "data-written-height-percent": String(attributes.writtenHeightPercent ?? 20),
        }),
      },
      // The RESOLVED value (percent x the active template's textHeightCm),
      // baked in at edit time — same "bake a literal cm from a percentage
      // at edit time, so the renderer never needs template context"
      // pattern as stats-chart-dialog.tsx's own customSize()/width. null
      // when no template with textHeightCm was available at the time the
      // percent was last set (most templates don't have this field yet —
      // see this feature's design doc's "open gaps"); the PDF converter
      // treats a null/absent value as "skip the written-blank area
      // entirely" rather than guessing a height.
      writtenHeightCm: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-written-height-cm");
          return raw ? Number(raw) : null;
        },
        renderHTML: (attributes) =>
          attributes.writtenHeightCm != null
            ? { "data-written-height-cm": String(attributes.writtenHeightCm) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="question-item"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "question-item" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuestionItemNodeView);
  },
});

function itemAttrsForKind(kind: QuestionKind) {
  return {
    kind,
    choices: Array.from({ length: defaultChoiceCount(kind) }, () => ""),
    writtenMode: DEFAULT_WRITTEN_MODE,
    writtenLines: 3,
    writtenHeightPercent: 20,
    writtenHeightCm: null,
  };
}

// Inserts a question BLOCK containing one item of the given kind — used
// by the toolbar button's kind menu. See appendQuestionItem below for
// the in-block "add question" button's equivalent.
export function insertQuestion(editor: Editor, kind: QuestionKind) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "question",
      content: [
        {
          type: "questionItem",
          attrs: itemAttrsForKind(kind),
          content: [{ type: "paragraph" }],
        },
      ],
    })
    .run();
}

// Appends a new item of the given kind to the END of an existing
// question container at `containerPos` (the container node's own
// position, as returned by a NodeView's getPos()) — used by the
// question-node-view.tsx "add question" button.
export function appendQuestionItem(editor: Editor, containerPos: number, kind: QuestionKind) {
  const containerNode = editor.state.doc.nodeAt(containerPos);
  if (!containerNode) return;
  const insertPos = containerPos + containerNode.nodeSize - 1;
  editor
    .chain()
    .focus()
    .insertContentAt(insertPos, {
      type: "questionItem",
      attrs: itemAttrsForKind(kind),
      content: [{ type: "paragraph" }],
    })
    .run();
}
