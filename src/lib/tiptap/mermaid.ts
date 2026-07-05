import type { Editor } from "@tiptap/core";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MermaidNodeView } from "@/components/editor/node-views/mermaid-node-view";

// Mermaid's own built-in themes (mermaid.initialize({theme})), plus
// "monochrome" — an app-level concept, not a real Mermaid theme name (its
// actual theme list is default/base/dark/forest/neutral/neo/redux/... none
// of them pure black-and-white). Both the editor (mermaid-node-view.tsx)
// and the Typst renderer (tiptap-to-typst.ts) resolve "monochrome" the same
// way: theme "base" plus themeVariables forcing every color role to black/
// white/gray — see MONOCHROME_THEME_VARIABLES below, the single shared
// source for both sides so they can't drift into rendering it differently.
export const MERMAID_THEMES = ["default", "base", "dark", "forest", "neutral", "monochrome"] as const;
export type MermaidTheme = (typeof MERMAID_THEMES)[number];
export const DEFAULT_MERMAID_THEME: MermaidTheme = "default";

export function normalizeMermaidTheme(value: unknown): MermaidTheme {
  return typeof value === "string" && (MERMAID_THEMES as readonly string[]).includes(value)
    ? (value as MermaidTheme)
    : DEFAULT_MERMAID_THEME;
}

// mermaid's own docs describe "base" as the theme meant to be customized via
// themeVariables; monochrome and the user's custom accent color both apply
// on top of it rather than whatever theme was previously selected.
export const MONOCHROME_THEME_VARIABLES = {
  background: "#ffffff",
  primaryColor: "#ffffff",
  primaryTextColor: "#000000",
  primaryBorderColor: "#000000",
  lineColor: "#000000",
  secondaryColor: "#ffffff",
  tertiaryColor: "#ffffff",
  textColor: "#000000",
} as const;

// User-customizable accent color (mermaid's `primaryColor` themeVariable) —
// only meaningful combined with theme "base" for the same reason as above;
// applying it under another theme name is a silent no-op, so the node view
// only shows this control when theme === "base".
export function isCustomizableTheme(theme: MermaidTheme): boolean {
  return theme === "base";
}

// Mermaid diagram block: raw Mermaid source (atom node — the source is an
// attribute, not editable ProseMirror content, same shape as blockMath's own
// `latex` attribute) rendered client-side via the `mermaid` package
// (see mermaid-node-view.tsx) and, on export, via Typst's merman package
// (see tiptap-to-typst.ts). width is a percentage of the editor width, same
// convention and resize-handle interaction as AnvilImage.
export const AnvilMermaid = Node.create({
  name: "mermaid",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      source: {
        default: "flowchart LR\n  A[Start] --> B[End]",
        parseHTML: (element) => element.getAttribute("data-source") ?? "",
        renderHTML: (attributes) => ({ "data-source": attributes.source ?? "" }),
      },
      theme: {
        default: DEFAULT_MERMAID_THEME,
        parseHTML: (element) => normalizeMermaidTheme(element.getAttribute("data-theme")),
        renderHTML: (attributes) => ({ "data-theme": normalizeMermaidTheme(attributes.theme) }),
      },
      // User-customizable accent color — see isCustomizableTheme's own
      // comment for why this only takes effect under theme "base".
      primaryColor: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-primary-color") || null,
        renderHTML: (attributes) =>
          attributes.primaryColor ? { "data-primary-color": attributes.primaryColor } : {},
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-width");
          return value ? Number(value) : null;
        },
        renderHTML: (attributes) =>
          attributes.width != null ? { "data-width": attributes.width } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "mermaid" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
});

export function insertMermaid(editor: Editor) {
  editor.chain().focus().insertContent({ type: "mermaid" }).run();
}
