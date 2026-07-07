import { Fragment } from "react";
import { renderMathPreview } from "@/lib/tiptap/math";

// Renders plain UI label text that may contain inline `$...$` math
// segments (e.g. i18n strings like "Rotate $y$ label") as real KaTeX,
// not literal dollar-sign characters — for short static labels (toggle/
// checkbox text), not user-editable math content (that's the editor's
// own inlineMath node). Invalid/unbalanced `$` falls back to showing the
// segment as plain text rather than throwing.
export function InlineMathText({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          const latex = part.slice(1, -1);
          const result = renderMathPreview(latex, false);
          if (result.ok) {
            return <span key={index} dangerouslySetInnerHTML={{ __html: result.html }} />;
          }
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}
