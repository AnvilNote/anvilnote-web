import { renderMathPreview } from "@/lib/tiptap/math";

// Figure/table captions are a plain string attribute (an <input>, not
// ProseMirror inline content — captions can't host a real inlineMath node),
// so math support here is lighter-weight: the user types $$...$$ (the same
// delimiter the editor's own inlineMath InputRule uses elsewhere, so there's
// no second syntax to learn) and it's rendered to KaTeX HTML for display,
// while the underlying attribute stays the raw string for editing.
const CAPTION_MATH_PATTERN = /\$\$([^$\n]+?)\$\$/g;
// A separate non-global instance for captionHasMath's .test() — sharing
// CAPTION_MATH_PATTERN would corrupt its lastIndex state across calls (only
// matchAll() safely ignores/resets that; .test() with a 'g' flag advances it).
const CAPTION_HAS_MATH_PATTERN = /\$\$([^$\n]+?)\$\$/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Renders a caption string to display HTML: plain text is HTML-escaped,
// $$...$$ segments are rendered as inline KaTeX. A segment that fails to
// parse as LaTeX falls back to its escaped raw text (including the $$
// delimiters) rather than dropping it, so a caption mid-edit (e.g. only the
// opening $$ typed so far) never disappears from view.
export function renderCaptionHtml(caption: string): string {
  let html = "";
  let lastIndex = 0;
  for (const match of caption.matchAll(CAPTION_MATH_PATTERN)) {
    const [full, latex] = match;
    const index = match.index ?? 0;
    html += escapeHtml(caption.slice(lastIndex, index));
    const preview = renderMathPreview(latex, false);
    html += preview.ok ? preview.html : escapeHtml(full);
    lastIndex = index + full.length;
  }
  html += escapeHtml(caption.slice(lastIndex));
  return html;
}

// Whether a caption contains any $$...$$ math segment at all — lets callers
// skip the display-mode round trip entirely for the common plain-text case.
export function captionHasMath(caption: string): boolean {
  return CAPTION_HAS_MATH_PATTERN.test(caption);
}
