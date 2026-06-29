"use client";

import { useTranslations } from "next-intl";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SUPPORTED_CODE_LANGUAGES,
  normalizeCodeLanguage,
} from "@/config/code-languages";

// React NodeView for code blocks. Renders the standard editable code surface
// (NodeViewContent) plus a custom language selector pinned to the top-left.
// The trigger is transparent (it floats over the code); the dropdown panel uses
// the popover surface. lowlight decorations still apply to the content.
export function CodeBlockNodeView({ node, updateAttributes }: NodeViewProps) {
  const t = useTranslations("editor.codeBlock");
  const language = normalizeCodeLanguage(
    node.attrs.language as string | undefined,
  );

  return (
    <NodeViewWrapper className="anvil-codeblock" data-language={language}>
      <div className="anvil-codeblock__toolbar" contentEditable={false}>
        <Select
          value={language}
          onValueChange={(value) =>
            updateAttributes({ language: normalizeCodeLanguage(value) })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label={t("selectLanguage")}
            // Transparent trigger; keep pointer events off ProseMirror.
            onMouseDown={(event) => event.stopPropagation()}
            className="h-6 gap-1 border-0 bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 data-[state=open]:text-foreground"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {SUPPORTED_CODE_LANGUAGES.map((entry) => (
              <SelectItem key={entry.value} value={entry.value} className="text-xs">
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <pre className={language === "text" ? undefined : `language-${language}`}>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
