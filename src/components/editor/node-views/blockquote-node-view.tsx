"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { BookPlus, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

type OpenPopover = "author" | "source" | null;

// React NodeView for blockquotes: the quoted content (NodeViewContent),
// a live attribution preview line mirroring exactly what
// tiptap-to-typst.ts's blockquote case will render in the exported PDF
// (right-aligned "— author, source", source in italic), and two small
// icon buttons (author/source) that each open a single-field popover to
// set that value — same click-icon-to-open-popover pattern as the color
// swatch buttons in stats-chart-dialog.tsx/function-plot-dialog.tsx.
//
// `as="blockquote"` (not the default plain <div>) keeps the existing
// `.ProseMirror blockquote` CSS (left border + muted color) applying
// unchanged — this NodeView only adds the attribution UI below the
// existing content, it doesn't restyle the quote itself.
export function BlockquoteNodeView({ node, updateAttributes }: NodeViewProps) {
  const t = useTranslations("editor.blockquote");
  const author = typeof node.attrs.author === "string" ? node.attrs.author : "";
  const source = typeof node.attrs.source === "string" ? node.attrs.source : "";
  const hasAttribution = Boolean(author || source);
  // Controlled, mutually exclusive: two independent uncontrolled Popovers
  // don't close each other, so clicking the second icon while the first
  // popover was still open left both visibly open at once, overlapping —
  // confirmed via a real reported screenshot, not just reasoned about.
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null);

  return (
    <NodeViewWrapper as="blockquote" className="relative">
      <NodeViewContent />
      {hasAttribution ? (
        <p className="mt-1 text-right text-sm text-muted-foreground" contentEditable={false}>
          — {author}
          {author && source ? ", " : ""}
          {source ? <em>{source}</em> : null}
        </p>
      ) : null}
      <div className="mt-1 flex items-center justify-end gap-1" contentEditable={false}>
        <Popover
          onOpenChange={(open) => setOpenPopover(open ? "author" : null)}
          open={openPopover === "author"}
        >
          <PopoverTrigger asChild>
            <button
              aria-label={t("author")}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
              onMouseDown={(event) => event.stopPropagation()}
              type="button"
            >
              <UserPlus className="size-3.5" />
              {author ? <span className="max-w-24 truncate">{author}</span> : null}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64" onMouseDown={(event) => event.stopPropagation()}>
            <Input
              autoFocus
              onChange={(event) => updateAttributes({ author: event.target.value })}
              placeholder={t("authorPlaceholder")}
              value={author}
            />
          </PopoverContent>
        </Popover>
        <Popover
          onOpenChange={(open) => setOpenPopover(open ? "source" : null)}
          open={openPopover === "source"}
        >
          <PopoverTrigger asChild>
            <button
              aria-label={t("source")}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
              onMouseDown={(event) => event.stopPropagation()}
              type="button"
            >
              <BookPlus className="size-3.5" />
              {source ? <span className="max-w-24 truncate">{source}</span> : null}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64" onMouseDown={(event) => event.stopPropagation()}>
            <Input
              autoFocus
              onChange={(event) => updateAttributes({ source: event.target.value })}
              placeholder={t("sourcePlaceholder")}
              value={source}
            />
          </PopoverContent>
        </Popover>
      </div>
    </NodeViewWrapper>
  );
}
