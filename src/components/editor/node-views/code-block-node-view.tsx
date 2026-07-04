"use client";

import { useTranslations } from "next-intl";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Trash2 } from "lucide-react";
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
// (NodeViewContent) plus a custom language selector pinned to the top-left,
// and a delete button pinned to the bottom-right — same corner/pattern as
// callout's own delete button (see callout-node-view.tsx's comment on why a
// plain onClick button, not layered on the shared drag handle, is used).
// The trigger is transparent (it floats over the code); the dropdown panel uses
// the popover surface. lowlight decorations still apply to the content.
export function CodeBlockNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useTranslations("editor.codeBlock");
  const tBlock = useTranslations("editor.block");
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

      <div className="anvil-codeblock__actions" contentEditable={false}>
        <button
          type="button"
          aria-label={tBlock("delete", { type: tBlock("types.codeBlock") })}
          title={tBlock("delete", { type: tBlock("types.codeBlock") })}
          onClick={deleteNode}
          onMouseDown={(event) => event.stopPropagation()}
          className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}
