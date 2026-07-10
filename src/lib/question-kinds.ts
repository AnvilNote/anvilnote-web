// Mirrors mermaid.ts's MERMAID_THEMES/normalizeMermaidTheme pattern —
// enum-style validation instead of a loose string union, so a corrupted
// or hand-edited data-kind/data-written-mode attribute on parse always
// resolves to a known-good value instead of `undefined`/garbage leaking
// into the NodeView or the PDF/Word converters. Same three repos
// (anvilnote-web, anvilnote-renderer, anvilnote-docx-exporter) each keep
// their own copy of this — no shared package between them, same
// duplication convention already established for question-choices.ts's
// displayWidth/choiceColumns.
export const QUESTION_KINDS = ["single", "multi", "written"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];
export const DEFAULT_QUESTION_KIND: QuestionKind = "single";

export function normalizeQuestionKind(value: unknown): QuestionKind {
  return typeof value === "string" && (QUESTION_KINDS as readonly string[]).includes(value)
    ? (value as QuestionKind)
    : DEFAULT_QUESTION_KIND;
}

export const WRITTEN_MODES = ["lines", "blank"] as const;
export type WrittenMode = (typeof WRITTEN_MODES)[number];
export const DEFAULT_WRITTEN_MODE: WrittenMode = "lines";

export function normalizeWrittenMode(value: unknown): WrittenMode {
  return typeof value === "string" && (WRITTEN_MODES as readonly string[]).includes(value)
    ? (value as WrittenMode)
    : DEFAULT_WRITTEN_MODE;
}

// Default choice count per kind, used by insertQuestion() and by the
// kind-switcher's "top up choices if still pristine" rule (see
// question-item-node-view.tsx).
export function defaultChoiceCount(kind: QuestionKind): number {
  return kind === "multi" ? 5 : 4;
}
