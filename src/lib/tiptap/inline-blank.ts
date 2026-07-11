import { Node, mergeAttributes } from "@tiptap/core";

// A plain inline blank for cloze-style prose ("the ______ he showed") —
// distinct from questionBlank (question-blank.ts): this has NO target, no
// live-resolved number, nothing to break if content moves around it. Just
// a fixed-width underline, ported from the reference personal template's
// blank(width) at
// /Users/anthonysung/tutoring/english/quiz/quiz-template.typ:73, fixed at
// 3em per explicit product decision (the reference template's own default
// arg is a variable width; this app exposes no width control at all —
// one size, no dialog, no attrs).
export const InlineBlank = Node.create({
  name: "inlineBlank",
  group: "inline",
  inline: true,
  atom: true,

  parseHTML() {
    return [{ tag: 'span[data-type="inline-blank"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "inline-blank",
        class: "anvil-inline-blank",
      }),
    ];
  },
});

export function insertInlineBlank(
  editor: import("@tiptap/core").Editor,
  range?: { from: number; to: number },
) {
  const chain = editor.chain().focus();
  if (range) chain.deleteRange(range);
  chain.insertContent({ type: "inlineBlank" }).run();
}
