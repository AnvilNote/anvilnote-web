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
}).configure({
  lowlight,
  defaultLanguage: "text",
});
