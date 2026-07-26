import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import katex from "katex";

type InlineDiffAction =
  | { type: "show-selection"; from: number; to: number }
  | {
      type: "show";
      from: number;
      to: number;
      replacementText: string;
      replacementContent?: JSONContent[];
    }
  | { type: "clear" };

export const inlineAIDiffPluginKey = new PluginKey<DecorationSet>("anvilnote-ai-inline-diff");

function safeLinkHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

function applyPreviewMarks(node: Node, marks: JSONContent["marks"]): Node {
  return (marks ?? []).reduce<Node>((content, mark) => {
    let wrapper: HTMLElement | null = null;
    if (mark.type === "bold") wrapper = document.createElement("strong");
    if (mark.type === "italic") wrapper = document.createElement("em");
    if (mark.type === "strike") wrapper = document.createElement("s");
    if (mark.type === "code") wrapper = document.createElement("code");
    if (mark.type === "underline") wrapper = document.createElement("u");
    if (mark.type === "link") {
      const href = safeLinkHref(mark.attrs?.href);
      if (href) {
        const link = document.createElement("a");
        link.href = href;
        wrapper = link;
      }
    }
    if (!wrapper) return content;
    wrapper.append(content);
    return wrapper;
  }, node);
}

function renderMathNode(node: JSONContent, displayMode: boolean): HTMLElement {
  const element = document.createElement("span");
  const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
  element.dataset.type = displayMode ? "block-math" : "inline-math";
  element.dataset.latex = latex;
  if (displayMode) element.className = "anvil-ai-inline-replacement__block-math";
  katex.render(latex, element, {
    displayMode,
    throwOnError: false,
    output: "html",
  });
  return element;
}

function appendPreviewNode(parent: Node, node: JSONContent): void {
  if (node.type === "text") {
    parent.appendChild(
      applyPreviewMarks(document.createTextNode(node.text ?? ""), node.marks),
    );
    return;
  }
  if (node.type === "hardBreak") {
    parent.appendChild(document.createTextNode("\n"));
    return;
  }
  if (node.type === "inlineMath" || node.type === "blockMath") {
    parent.appendChild(renderMathNode(node, node.type === "blockMath"));
    return;
  }

  const block = [
    "paragraph",
    "heading",
    "blockquote",
    "codeBlock",
    "bulletList",
    "orderedList",
    "listItem",
  ].includes(node.type ?? "");
  const container = document.createElement("span");
  if (block) container.className = "anvil-ai-inline-replacement__block";
  for (const child of node.content ?? []) appendPreviewNode(container, child);
  parent.appendChild(container);
}

function renderReplacement(
  replacement: HTMLElement,
  replacementText: string,
  replacementContent?: readonly JSONContent[],
): void {
  if (!replacementContent?.length) {
    replacement.textContent = replacementText;
    return;
  }
  try {
    replacementContent.forEach((node, index) => {
      if (index) replacement.appendChild(document.createTextNode("\n"));
      appendPreviewNode(replacement, node);
    });
  } catch {
    replacement.replaceChildren(document.createTextNode(replacementText));
  }
}

function makeDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  from: number,
  to: number,
  replacementText: string,
  replacementContent?: readonly JSONContent[],
): DecorationSet {
  if (from < 0 || to < from || to > doc.content.size) return DecorationSet.empty;
  const replacement = document.createElement("span");
  replacement.className = "anvil-ai-inline-replacement";
  replacement.style.color = "#939bc9";
  renderReplacement(replacement, replacementText, replacementContent);
  return DecorationSet.create(doc, [
    Decoration.inline(from, to, {
      class: "anvil-ai-inline-original",
      style: "color: #dc2626; text-decoration: line-through;",
    }),
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
            action.replacementContent,
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
  input: {
    from: number;
    to: number;
    replacementText: string;
    replacementContent?: JSONContent[];
  },
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
