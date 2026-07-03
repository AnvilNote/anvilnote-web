// Per-language cross-reference display text for the Markdown/DOCX export
// fallback paths, based on the DOCUMENT's own language
// (doc.templateSettings.primaryLang — the same field the font picker uses)
// — NOT the UI locale of whoever is currently exporting. A document
// written in Chinese should still say "圖 1" in its exported .md/.docx even
// if the exporter's own interface is displayed in Japanese.
//
// Not sourced from next-intl: tiptap-to-markdown.ts is a plain converter
// function with no React context, so a useTranslations() hook isn't
// available here. Kept in sync with messages/*.json's
// editor.crossRef.labels by hand instead — same strings, mirrored again in
// anvilnote-renderer's config/cross-ref-labels.ts and
// anvilnote-docx-exporter's own copy (this app's existing pattern for
// small cross-repo constants; see e.g. config/callouts.ts).
//
// Figure/table: "{supplement} {number}" (space, no parens — "圖 1"/"Figure
// 1"). Equation: "{supplement} ({number})" (space AND parens — "式
// (1)"/"Equation (1)") — a deliberate design decision, not an oversight.
// Headings have no supplement at all; a heading crossRef is just the
// heading's own text.
export type CrossRefPrimaryLang = "zh" | "en" | "ja" | "ko" | "th";

const SUPPLEMENTS: Record<CrossRefPrimaryLang, { figure: string; table: string; equation: string }> = {
  zh: { figure: "圖", table: "表", equation: "式" },
  en: { figure: "Figure", table: "Table", equation: "Equation" },
  ja: { figure: "図", table: "表", equation: "式" },
  ko: { figure: "그림", table: "표", equation: "식" },
  th: { figure: "รูปที่", table: "ตารางที่", equation: "สมการ" },
};

const DEFAULT_PRIMARY_LANG: CrossRefPrimaryLang = "zh";

function normalizePrimaryLang(value: string | undefined): CrossRefPrimaryLang {
  return value && value in SUPPLEMENTS ? (value as CrossRefPrimaryLang) : DEFAULT_PRIMARY_LANG;
}

// `value` is the already-resolved number string (e.g. "1") stored on the
// crossRef node's own resolvedValue attr by cross-ref.ts's editor-side
// resolver — this only formats it, it never recomputes it. A named
// equation's refName is only a readable label in the editor's @ suggestion
// list — resolvedValue is always the plain sequence number regardless,
// confirmed directly with the user (a named equation's crossRef still
// shows "式 (1)", not the name).
export function formatCrossRefLabel(
  kind: "figure" | "table" | "equation" | "heading",
  value: string,
  primaryLang: string | undefined,
): string {
  if (kind === "heading") return value;

  const lang = normalizePrimaryLang(primaryLang);
  const supplement = SUPPLEMENTS[lang][kind];
  return kind === "equation" ? `${supplement} (${value})` : `${supplement} ${value}`;
}
