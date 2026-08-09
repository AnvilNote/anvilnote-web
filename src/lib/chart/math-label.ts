// Plotly/MathJax only fully typesets a title/axis-label when the ENTIRE
// string is one $...$ block — a natural mix like "Hi $x$" silently drops
// everything OUTSIDE the $...$ pair when Plotly actually draws it (only
// "x" survives, "Hi " vanishes; verified against a live render). Users
// still get to type that natural mixed syntax though, matching the $...$
// convention AnvilNote's own document editor already uses — this wraps it
// into the single-block form Plotly needs right before it's sent, turning
// each plain-text segment into \text{...} and keeping each $...$ segment's
// own LaTeX source as-is. decodeMathLabel is the inverse, used when
// reopening a saved chart so the input field shows the natural form again,
// not the encoded one.

const MATH_SEGMENT = /(\$[^$]+\$)/g;
const HAS_MATH_SEGMENT = /\$[^$]+\$/; // separate non-global regex — .test() on MATH_SEGMENT would mutate its shared lastIndex
// [^{}] alone would stop at the FIRST literal `}`, including an escaped
// `\}` inside the content (character classes don't know about the
// preceding backslash) — \\. consumes an escaped pair as one unit first,
// so a real \} only ever gets reached as the deliberate closing brace.
const TEXT_SEGMENT = /\\text\{((?:\\.|[^{}])*)\}/g;

function escapeLatexText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/[{}]/g, "\\$&");
}

function unescapeLatexText(text: string): string {
  return text.replace(/\\([\\{}])/g, "$1");
}

export function encodeMathLabel(raw: string): string {
  if (!HAS_MATH_SEGMENT.test(raw)) return raw; // no $...$ segment — plain text, leave untouched
  const body = raw
    .split(MATH_SEGMENT)
    .map((part) => {
      if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) return part.slice(1, -1);
      return part ? `\\text{${escapeLatexText(part)}}` : "";
    })
    .join("");
  return `$${body}$`;
}

export function decodeMathLabel(encoded: string): string {
  const trimmed = encoded.trim();
  if (!(trimmed.length > 2 && trimmed.startsWith("$") && trimmed.endsWith("$"))) return encoded;
  const inner = trimmed.slice(1, -1);
  return inner
    .split(TEXT_SEGMENT)
    .map((part, index) => {
      if (index % 2 === 1) return unescapeLatexText(part); // captured \text{...} content
      return part ? `$${part}$` : "";
    })
    .join("");
}
