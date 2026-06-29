"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { useTranslations } from "next-intl";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// A small inline URL field that floats just below the current selection — no
// browser prompt, no modal dialog. The selection range is captured on mount so
// applying the link still targets the marked text after the input takes focus.
export function LinkInput({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const t = useTranslations("editor.toolbar");
  // Capture the selection range and screen position once, on mount. The editor
  // isn't edited while the field is focused, so these stay valid.
  const [range] = useState(() => {
    const { from, to } = editor.state.selection;
    return { from, to };
  });
  const [position] = useState(() => {
    const { from, to } = editor.state.selection;
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    return {
      left: Math.min(start.left, end.left),
      top: Math.max(start.bottom, end.bottom),
    };
  });
  const [value, setValue] = useState(
    () => (editor.getAttributes("link").href as string) ?? "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function apply() {
    const raw = value.trim();
    const { from, to } = range;
    const chain = editor.chain().focus().setTextSelection({ from, to });
    if (!raw) {
      chain.extendMarkRange("link").unsetLink().run();
    } else {
      const href = /^[a-z][\w+.-]*:/i.test(raw) ? raw : `https://${raw}`;
      chain.extendMarkRange("link").setLink({ href }).run();
    }
    onClose();
  }

  function remove() {
    const { from, to } = range;
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .extendMarkRange("link")
      .unsetLink()
      .run();
    onClose();
  }

  const hasLink = Boolean(editor.getAttributes("link").href);

  return (
    <>
      {/* Click-away layer closes without applying. */}
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        style={{
          position: "fixed",
          left: position.left,
          top: position.top + 6,
          zIndex: 50,
        }}
        className="flex items-center gap-1 rounded-lg border bg-popover p-1 shadow-md"
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              apply();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          placeholder="https://…"
          className="h-7 w-56 rounded bg-transparent px-2 text-sm outline-none"
        />
        <button
          type="button"
          title={t("linkApply")}
          aria-label={t("linkApply")}
          onClick={apply}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          )}
        >
          <Check className="size-4" />
        </button>
        {hasLink ? (
          <button
            type="button"
            title={t("linkRemove")}
            aria-label={t("linkRemove")}
            onClick={remove}
            className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
    </>
  );
}
