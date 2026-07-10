import type { Editor } from "@tiptap/core";
import { Node, mergeAttributes } from "@tiptap/core";
import { DOMParser as PMDOMParser, Fragment } from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { QuestionNodeView } from "@/components/editor/node-views/question-node-view";
import { QuestionItemNodeView } from "@/components/editor/node-views/question-item-node-view";
import { ChoiceItemNodeView } from "@/components/editor/node-views/choice-item-node-view";
import { ChoiceListNodeView } from "@/components/editor/node-views/choice-list-node-view";
import {
  type QuestionKind,
  DEFAULT_QUESTION_KIND,
  DEFAULT_WRITTEN_MODE,
  defaultChoiceCount,
  normalizeQuestionKind,
  normalizeWrittenMode,
} from "@/lib/question-kinds";

// A single choice's content — exactly one of: a rich-text paragraph
// (bold/italic/inlineMath all already work, it's a normal paragraph),
// a single image, or a single block-math equation. No attrs of its own
// — which of the three is present is read directly from
// node.content.firstChild.type.name at render time (both here and in
// anvilnote-renderer's tiptap-to-typst.ts / anvilnote-docx-exporter's
// tiptap-to-pandoc-markdown.ts).
export const AnvilChoiceItem = Node.create({
  name: "choiceItem",
  content: "paragraph | image | blockMath",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="choice-item"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "choice-item" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChoiceItemNodeView);
  },
});

// Pure container for a questionItem's choices — replaces v2's
// choices:string[] attribute. Sits as the LAST child in questionItem's
// own content stream (after the body paragraph(s)), only present when
// kind is "single" or "multi" (a "written" item's content is just its
// body, no choiceList).
export const AnvilChoiceList = Node.create({
  name: "choiceList",
  group: "block",
  content: "choiceItem+",
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="choice-list"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "choice-list" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChoiceListNodeView);
  },
});

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
  content: "block+ choiceList?",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      kind: {
        default: DEFAULT_QUESTION_KIND,
        parseHTML: (element) => normalizeQuestionKind(element.getAttribute("data-kind")),
        renderHTML: (attributes) => ({ "data-kind": normalizeQuestionKind(attributes.kind) }),
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
      // Multi -> single removes the LAST choiceItem rather than silently
      // discarding it — it's parked here. Single -> multi restores it
      // (or appends a fresh empty-paragraph choiceItem if nothing's
      // parked, e.g. a fresh single->multi switch that's never been
      // multi before) — see question-item-node-view.tsx's
      // handleKindChange. Only touched by single<->multi transitions;
      // switching to/from "written" leaves this stash alone. Serialized
      // ProseMirror JSON of the last choiceItem removed when switching
      // multi -> single (v3: a stashed choice can now be an image or
      // equation, not just text, so a plain string can't hold it — this
      // stores editor.schema.nodeFromJSON-compatible JSON, restored via
      // JSON.parse + nodeFromJSON when switching back to multi). null
      // when nothing is stashed.
      stashedChoiceJSON: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-stashed-choice-json"),
        renderHTML: (attributes) =>
          attributes.stashedChoiceJSON != null
            ? { "data-stashed-choice-json": attributes.stashedChoiceJSON }
            : {},
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
    return [
      {
        tag: 'div[data-type="question-item"]',
        // Migration: a v2 document has NO choice-list child in its DOM
        // at all — its choices lived entirely in the now-deleted
        // data-choices JSON-array attribute. If that attribute is
        // present, parse the element's real DOM children normally (the
        // body paragraph(s)) and append a synthesized choiceList (one
        // plain-paragraph choiceItem per array entry) as a real child,
        // so the document round-trips into the new v3 shape on next
        // save instead of silently losing every choice it had. When
        // data-choices is absent (already-migrated or fresh v3
        // documents), this just parses the DOM children normally —
        // identical to not having a getContent override at all.
        getContent: (domNode, schema) => {
          const element = domNode as HTMLElement;
          const parser = PMDOMParser.fromSchema(schema);
          const parsedFragment = parser.parseSlice(element, { preserveWhitespace: true }).content;

          const raw = element.getAttribute?.("data-choices");
          if (!raw) return parsedFragment;
          let choices: unknown;
          try {
            choices = JSON.parse(raw);
          } catch {
            return parsedFragment;
          }
          if (!Array.isArray(choices) || choices.length === 0) return parsedFragment;
          const choiceItemType = schema.nodes.choiceItem;
          const paragraphType = schema.nodes.paragraph;
          const choiceListType = schema.nodes.choiceList;
          if (!choiceItemType || !paragraphType || !choiceListType) return parsedFragment;
          const items = choices.map((choice) =>
            choiceItemType.create(
              null,
              paragraphType.create(
                null,
                typeof choice === "string" && choice ? schema.text(choice) : undefined,
              ),
            ),
          );
          const choiceListNode = choiceListType.create(null, items);
          return parsedFragment.append(Fragment.from(choiceListNode));
        },
      },
    ];
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
    stashedChoiceJSON: null,
    writtenMode: DEFAULT_WRITTEN_MODE,
    writtenLines: 3,
    writtenHeightPercent: 20,
    writtenHeightCm: null,
  };
}

// Builds the content array for a fresh questionItem: one empty body
// paragraph, plus (for single/multi kind only) a trailing choiceList
// with the kind's default empty-choice count.
function itemContentForKind(kind: QuestionKind) {
  const body = [{ type: "paragraph" }];
  if (kind === "written") return body;
  const count = defaultChoiceCount(kind);
  return [
    ...body,
    {
      type: "choiceList",
      content: Array.from({ length: count }, () => ({
        type: "choiceItem",
        content: [{ type: "paragraph" }],
      })),
    },
  ];
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
          content: itemContentForKind(kind),
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
      content: itemContentForKind(kind),
    })
    .run();
}
