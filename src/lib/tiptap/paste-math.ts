import type { JSONContent } from "@tiptap/core";

// Pasting a plain-text AI reply (or any plain-text source) that contains
// LaTeX math syntax previously landed as literal characters — the editor has
// no rich clipboard data to fall back on for a plain-text paste, and
// ProseMirror's default plain-text paste path just inserts the raw string.
// This is intentionally narrower than the full markdown-to-tiptap.ts
// converter: it only recognizes math syntax, leaving every other character
// (including other markdown-looking syntax like "**bold**" or "# heading")
// as literal text, so an ordinary paste that happens to contain a stray "#"
// or "-" isn't reinterpreted as formatting.
//
// Three delimiter styles are recognized, since different AI tools' "copy
// reply" output varies:
//   - "$...$" / "$$...$$"      the canonical pair this app's own editor uses
//   - "\(...\)" / "\[...\]"     the other common LaTeX convention
//   - a bare "[...]" alone on its own paragraph  block math whose leading
//     backslash got eaten upstream — reproduced from a real ticket: some
//     external tool's own markdown pipeline treats "\[" as CommonMark's
//     backslash-escape of a literal "[" and drops the backslash on
//     serialization, so the pasted text has bare "[""]" pairs instead of
//     "\[""\]". Deliberately NOT extended to bare "(...)" for inline math —
//     ordinary parenthetical text is far too common to safely reinterpret.
//
// NOT handled: that same real-world sample also had stray "==========" /
// "# " lines injected INSIDE the math body (a chained "A = B = C" LaTeX
// equality getting mangled by that external tool's markdown formatter into
// what looks like a setext-heading underline and an ATX heading marker).
// That's lossy, tool-specific corruption upstream of the clipboard, not a
// delimiter format — there's no reliable way to reconstruct the original
// "=" from it here without risking false positives on unrelated pasted
// text, so it's left as literal text same as any other paste.

const INLINE_MATH = /\$([^$\n]+)\$|\\\(([\s\S]+?)\\\)/g;
const BLOCK_MATH_ONLY =
  /^(?:\$\$\n?([\s\S]+?)\n?\$\$|\\\[\n?([\s\S]+?)\n?\\\]|\[\n?([\s\S]+?)\n?\])$/;

// Derived from parsePastedMathText's own actual output — not a second,
// separately-maintained regex — so a delimiter style can never be taught to
// one function without the other (a real bug: the bare-"[...]" case was
// added to BLOCK_MATH_ONLY below but not mirrored here, so handlePaste's own
// early-return guard in tiptap-editor.tsx silently kept skipping it and
// falling through to a literal-text paste, exactly the parser having zero
// effect that this whole file exists to fix).
export function containsMathSyntax(text: string): boolean {
  return parsePastedMathText(text).some(
    (node) =>
      node.type === "blockMath" ||
      (node.type === "paragraph" &&
        node.content?.some((child) => child.type === "inlineMath")),
  );
}

function parseInlineMath(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_MATH)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, index) });
    }
    nodes.push({ type: "inlineMath", attrs: { latex: match[1] ?? match[2] } });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }
  return nodes;
}

/**
 * Parse plain-text clipboard content into paragraph/blockMath nodes,
 * recognizing "$...$"/"$$...$$", "\(...\)"/"\[...\]", and a bare "[...]"
 * block on its own paragraph. Paragraphs are split on blank lines, matching
 * normal paste-as-paragraphs behavior.
 */
export function parsePastedMathText(text: string): JSONContent[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block): JSONContent => {
      const blockMatch = BLOCK_MATH_ONLY.exec(block);
      if (blockMatch) {
        const latex = blockMatch[1] ?? blockMatch[2] ?? blockMatch[3];
        return { type: "blockMath", attrs: { latex } };
      }
      return { type: "paragraph", content: parseInlineMath(block) };
    });
}
