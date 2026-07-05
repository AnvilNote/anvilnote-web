import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import { normalizeCodeLanguage } from "@/config/code-languages";
import { CodeBlockNodeView } from "@/components/editor/node-views/code-block-node-view";

const lowlight = createLowlight(common);

// CodeBlockLowlight extended so each code block carries a normalized `language`
// (default "text"), round-trips it through data-language / class="language-*",
// and renders the React NodeView with the language selector. The node name
// stays "codeBlock" — StarterKit's built-in code block is disabled to avoid a
// duplicate registration.
export const AnvilCodeBlock = CodeBlockLowlight.extend({
  name: "codeBlock",

  addAttributes() {
    return {
      ...this.parent?.(),

      language: {
        default: "text",
        parseHTML: (element) => {
          const dataLanguage = element.getAttribute("data-language");
          if (dataLanguage) return normalizeCodeLanguage(dataLanguage);

          const className =
            element.getAttribute("class") ??
            element.firstElementChild?.getAttribute("class") ??
            "";
          const match = className.match(/language-([a-zA-Z0-9_+#-]+)/);
          return normalizeCodeLanguage(match?.[1]);
        },
        renderHTML: (attributes) => {
          const language = normalizeCodeLanguage(
            attributes.language as string | undefined,
          );
          return {
            "data-language": language,
            class: language === "text" ? null : `language-${language}`,
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },

  // Fixed 4 spaces, not the browser's default Tab-to-next-focusable-element
  // behavior — CodeBlockLowlight (unlike e.g. CodeMirror-backed editors)
  // doesn't handle Tab on its own.
  //
  // Enter carries the previous line's leading whitespace onto the new
  // line — same reasoning: CodeBlockLowlight's content is plain text
  // ("text*", a single textblock with literal \n characters, not a
  // paragraph-per-line structure), so a plain Enter starts the new line
  // at column 0 with no indent carried over, unlike a real code editor.
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!this.editor.isActive(this.name)) return false;
        return this.editor.commands.insertContent("    ");
      },
      Enter: () => {
        if (!this.editor.isActive(this.name)) return false;
        const { $from } = this.editor.state.selection;
        const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
        const lastLine = textBefore.slice(textBefore.lastIndexOf("\n") + 1);
        const indent = lastLine.match(/^[ \t]*/)?.[0] ?? "";
        return this.editor.commands.insertContent(`\n${indent}`);
      },
    };
  },
}).configure({
  lowlight,
  defaultLanguage: "text",
});
