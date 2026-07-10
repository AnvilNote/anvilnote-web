import type { Editor } from "@tiptap/core";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { QuestionNodeView } from "@/components/editor/node-views/question-node-view";

// Multiple-choice question block: a numbered body (numbered live by
// question-node-view.tsx's useQuestionNumber — not stored, since the
// number is just "how many question nodes precede this one") plus a
// choices list rendered as an auto-columned (1/2/4, see
// question-choices.ts) grid once editing is done. Modeled on the
// reference personal template's question()/choices() pair (see
// /Users/anthonysung/tutoring/english/quiz/quiz-template.typ) — this is
// the editor-side half; anvilnote-renderer's tiptap-to-typst.ts and
// anvilnote-docx-exporter's tiptap-to-pandoc-markdown.ts export it to
// PDF/Word.
export const AnvilQuestion = Node.create({
  name: "question",
  group: "block",
  content: "block+",
  defining: true,
  // Prevents a question node from being pasted/nested inside another
  // question node's body: "block+" would otherwise accept "question"
  // itself (it's in the "block" group). `isolating: true` blocks other
  // block-group nodes' content model from reaching in and stops
  // ProseMirror's paste/lift logic from nesting — same fix pattern as
  // callout.ts. Nesting would double-count in useQuestionNumber and
  // doesn't match the reference Typst template (no nesting).
  isolating: true,

  addAttributes() {
    return {
      choices: {
        default: ["", "", "", ""],
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
    };
  },

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

// Insert with the reference template's own default: 4 blank choices,
// ready to fill in immediately (no separate "add choices" step needed for
// the common 4-option case).
export function insertQuestion(editor: Editor) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "question",
      attrs: { choices: ["", "", "", ""] },
      content: [{ type: "paragraph" }],
    })
    .run();
}
