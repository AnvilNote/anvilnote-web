import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { QuestionBlankNodeView } from "@/components/editor/node-views/question-blank-node-view";

// Inline atom referencing a questionItem's live number — NOT a reuse of
// crossRef's node/NodeView (only cross-ref.ts's id/resolver PATTERN is
// shared; the display is a completely different shape, an underlined
// cloze blank, not a clickable chip). resolvedValue/broken are never set
// by the user — cross-ref.ts's resolver plugin recomputes them on every
// doc change, exactly like it already does for crossRef.
export const QuestionBlank = Node.create({
  name: "questionBlank",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      targetId: { default: null },
      resolvedValue: { default: null },
      broken: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="question-blank"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "question-blank" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuestionBlankNodeView);
  },
});

export function insertQuestionBlank(
  editor: import("@tiptap/core").Editor,
  targetId: string,
  range?: { from: number; to: number },
) {
  const chain = editor.chain().focus();
  if (range) chain.deleteRange(range);
  chain.insertContent({ type: "questionBlank", attrs: { targetId } }).run();
}
