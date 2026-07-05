import type { Editor } from "@tiptap/core";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ProofNodeView } from "@/components/editor/node-views/proof-node-view";

// Proof: a minimal block for writing out mathematical/logical proofs —
// header always reads the localized "證明"/"Proof"/etc. label (never a
// user-editable title, unlike callout's kind+title), a solid QED square (■)
// pinned bottom-right marks the end. Deliberately not on the toolbar (a
// niche, occasional-use block) — slash-menu only, same "small feature, no
// toolbar real estate" reasoning as inline text color's own entry point.
//
// Unlike every other block in the editor, proof's text always renders in a
// fixed sans-serif stack (Source Han Sans/思源黑體 for CJK) regardless of
// the document's chosen title/body font — see globals.css's --font-proof —
// so a proof visually reads the same in every document, the way it would in
// a printed textbook's distinct "Proof." typography convention.
export const AnvilProof = Node.create({
  name: "proof",
  group: "block",
  // Same content spec as callout (paragraph/list/code/math/image) — see
  // callout.ts's own comment for why each of those is included.
  content: "(paragraph|bulletList|orderedList|codeBlock|blockMath|image)+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="proof"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "proof" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ProofNodeView);
  },

  // Mirrors callout's own Shift-Enter-to-exit keyboard shortcut exactly —
  // see callout.ts's comment on why isolating:true needs this explicit
  // escape gesture (plain Enter stays inside, for multi-paragraph proofs).
  addKeyboardShortcuts() {
    return {
      "Shift-Enter": () => {
        const { $from } = this.editor.state.selection;
        let proofDepth = -1;
        for (let d = $from.depth; d > 0; d -= 1) {
          if ($from.node(d).type.name === this.name) {
            proofDepth = d;
            break;
          }
        }
        if (proofDepth === -1) return false;

        const afterPos = $from.after(proofDepth);
        return this.editor
          .chain()
          .insertContentAt(afterPos, { type: "paragraph" })
          .setTextSelection(afterPos + 1)
          .focus()
          .run();
      },
    };
  },
});

export function insertProof(editor: Editor) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "proof",
      content: [{ type: "paragraph" }],
    })
    .run();
}
