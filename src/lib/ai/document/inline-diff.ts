import { Extension, type Editor } from "@tiptap/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";

type InlineDiffAction =
  | { type: "show-selection"; from: number; to: number }
  | { type: "show"; from: number; to: number; replacementText: string }
  | { type: "clear" };

export const inlineAIDiffPluginKey = new PluginKey<DecorationSet>("anvilnote-ai-inline-diff");

function makeDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  from: number,
  to: number,
  replacementText: string,
): DecorationSet {
  if (from < 0 || to < from || to > doc.content.size) return DecorationSet.empty;
  const replacement = document.createElement("span");
  replacement.className = "anvil-ai-inline-replacement";
  replacement.textContent = replacementText;
  return DecorationSet.create(doc, [
    Decoration.inline(from, to, { class: "anvil-ai-inline-original" }),
    Decoration.widget(to, replacement, { side: 1, key: "anvil-ai-inline-replacement" }),
  ]);
}

function makeSelectionDecoration(
  doc: Parameters<typeof DecorationSet.create>[0],
  from: number,
  to: number,
): DecorationSet {
  if (from < 0 || to <= from || to > doc.content.size) return DecorationSet.empty;
  return DecorationSet.create(doc, [
    Decoration.inline(from, to, { class: "anvil-ai-inline-selection" }),
  ]);
}

function createInlineAIDiffPlugin() {
  return new Plugin<DecorationSet>({
    key: inlineAIDiffPluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(transaction, previous) {
        const action = transaction.getMeta(inlineAIDiffPluginKey) as InlineDiffAction | undefined;
        if (action?.type === "clear" || transaction.docChanged) return DecorationSet.empty;
        if (action?.type === "show-selection") {
          return makeSelectionDecoration(transaction.doc, action.from, action.to);
        }
        if (action?.type === "show") {
          return makeDecorations(
            transaction.doc,
            action.from,
            action.to,
            action.replacementText,
          );
        }
        return previous;
      },
    },
    props: {
      decorations(state) {
        return inlineAIDiffPluginKey.getState(state) ?? null;
      },
    },
  });
}

/**
 * Production editors install the decoration state once, together with the
 * rest of their Tiptap extensions. A BubbleMenu is a floating portal and must
 * not own the lifetime of editor state that needs to outlive its re-renders.
 */
export const InlineAIDiffExtension = Extension.create({
  name: "anvilNoteInlineAIDiff",
  addProseMirrorPlugins() {
    return [createInlineAIDiffPlugin()];
  },
});

function installed(editor: Editor): boolean {
  return inlineAIDiffPluginKey.getState(editor.state) !== undefined;
}

/** Keep the exact editor range visible after focus moves into the composer. */
export function showInlineAISelection(
  editor: Editor,
  input: { from: number; to: number },
): void {
  if (!installed(editor)) editor.registerPlugin(createInlineAIDiffPlugin());
  editor.view.dispatch(editor.state.tr.setMeta(inlineAIDiffPluginKey, {
    type: "show-selection",
    ...input,
  } satisfies InlineDiffAction));
}

/**
 * The source document remains untouched until the person explicitly accepts
 * the rewrite. Any document transaction automatically clears the decoration,
 * preventing a visual diff from becoming stale.
 */
export function showInlineAIDiff(
  editor: Editor,
  input: { from: number; to: number; replacementText: string },
): void {
  if (!installed(editor)) editor.registerPlugin(createInlineAIDiffPlugin());
  editor.view.dispatch(editor.state.tr.setMeta(inlineAIDiffPluginKey, {
    type: "show",
    ...input,
  } satisfies InlineDiffAction));
}

export function clearInlineAIDiff(editor: Editor): void {
  if (!installed(editor)) return;
  editor.view.dispatch(editor.state.tr.setMeta(inlineAIDiffPluginKey, { type: "clear" } satisfies InlineDiffAction));
}
