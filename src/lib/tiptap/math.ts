import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import katex from "katex";

// Thin wrappers over the official @tiptap/extension-mathematics commands. The
// extension registers two nodes — `inlineMath` and `blockMath` — each storing
// its source in a `latex` attribute. We keep LaTeX verbatim; the renderer (not
// the web app) converts it to Typst at export time.

export function insertInlineMath(editor: Editor, latex: string): boolean {
  return editor.chain().focus().insertInlineMath({ latex }).run();
}

// refName is the optional user-given display name shown by the cross-ref
// suggestion list instead of raw LaTeX. The extension's own insertBlockMath
// command only knows `latex`, so a named insert goes through insertContent
// with explicit attrs instead.
export function insertBlockMath(editor: Editor, latex: string, refName?: string): boolean {
  const name = refName?.trim();
  if (name) {
    return editor
      .chain()
      .focus()
      .insertContent({ type: "blockMath", attrs: { latex, refName: name } })
      .run();
  }
  return editor.chain().focus().insertBlockMath({ latex }).run();
}

export function updateInlineMath(
  editor: Editor,
  pos: number,
  latex: string,
): boolean {
  return editor.chain().focus().updateInlineMath({ latex, pos }).run();
}

export function updateBlockMath(
  editor: Editor,
  pos: number,
  latex: string,
  refName?: string,
): boolean {
  return editor
    .chain()
    .focus()
    .updateBlockMath({ latex, pos })
    // The extension's update command spreads ...node.attrs, so it preserves
    // refName but can't CHANGE it — write it separately in the same chain.
    // Empty/whitespace input clears the name back to null.
    .command(({ tr }) => {
      tr.setNodeAttribute(pos, "refName", refName?.trim() || null);
      return true;
    })
    .run();
}

export function deleteInlineMath(editor: Editor, pos: number): boolean {
  return editor.chain().focus().deleteInlineMath({ pos }).run();
}

export function deleteBlockMath(editor: Editor, pos: number): boolean {
  return editor.chain().focus().deleteBlockMath({ pos }).run();
}

// Render LaTeX to KaTeX HTML for the live dialog preview. Never throws — invalid
// input returns an `{ ok: false }` result with KaTeX's error message so callers
// can show a hint without crashing the editor.
export function renderMathPreview(
  latex: string,
  displayMode: boolean,
): { ok: true; html: string } | { ok: false; error: string } {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      output: "html",
    });
    return { ok: true, html };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid equation",
    };
  }
}

export function isValidLatex(latex: string): boolean {
  if (!latex.trim()) return false;
  return renderMathPreview(latex, false).ok;
}

// blockMath is an atom node (no editable content, per @tiptap/extension-
// mathematics) with no keyboard shortcuts of its own — pressing Enter while
// it's selected, or right after one with nothing following it (e.g. it's
// the last node in the document), otherwise does nothing. Insert a fresh
// paragraph and move the cursor there, same escape-hatch pattern as
// callout.ts's Shift-Enter (blockMath has no "content inside" for plain
// Enter to conflict with, so it doesn't need the Shift modifier).
export const BlockMathExit = Extension.create({
  name: "blockMathExit",
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { selection } = this.editor.state;
        let afterPos: number | null = null;

        if (selection instanceof NodeSelection && selection.node.type.name === "blockMath") {
          afterPos = selection.to;
        } else {
          const { $from } = selection;
          if ($from.nodeBefore?.type.name === "blockMath") {
            afterPos = $from.pos;
          }
        }

        if (afterPos === null) return false;

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
