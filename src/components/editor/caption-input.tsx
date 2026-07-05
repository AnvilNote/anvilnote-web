"use client";

import { useState } from "react";
import { captionHasMath, renderCaptionHtml } from "@/lib/tiptap/caption-math";

// Figure/table caption editing with lightweight $$...$$ math display: a
// plain <input> can't host a real inlineMath node (captions are a string
// attribute, not ProseMirror content), so instead this shows the raw text
// while focused/editing and a KaTeX-rendered preview once you click away —
// same "type the source, preview when done" pattern as the math dialog
// itself, just inline instead of in a popup. Captions with no $$ segment
// never leave <input> mode at all, so the common plain-text case is
// unaffected (no click-to-edit step to discover).
export function CaptionInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing && value && captionHasMath(value)) {
    return (
      <div
        role="textbox"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") setEditing(true);
        }}
        onMouseDown={(event) => event.stopPropagation()}
        className={className}
        dangerouslySetInnerHTML={{ __html: renderCaptionHtml(value) }}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.currentTarget.value)}
      onBlur={() => setEditing(false)}
      onMouseDown={(event) => event.stopPropagation()}
      className={className}
      autoFocus={editing}
    />
  );
}
