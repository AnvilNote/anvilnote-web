// Auto-layout heuristic for a question block's choices: 4-in-a-row -> 2x2
// -> 1-per-line, based on average visible character width across the
// non-empty options. Ported from the reference personal template at
// /Users/anthonysung/tutoring/english/quiz/quiz-template.typ. Extended
// (v3 — rich content) beyond plain strings: a choice can now be an
// image or a block-math equation, neither of which has a natural
// "character width" — both count as a flat nominal width
// (IMAGE_OR_MATH_NOMINAL_WIDTH) in the same averaging math a text
// choice's real displayWidth() would otherwise contribute, tuned so a
// single image/equation choice alone pushes the layout toward 1 column
// (matches a long text choice) while a couple of them mixed with short
// text choices can still average into 2 columns.
export type ChoiceEntry = { kind: "text"; text: string } | { kind: "image" } | { kind: "blockMath" };

const IMAGE_OR_MATH_NOMINAL_WIDTH = 20;

export function displayWidth(s: string): number {
  let w = 0;
  for (const c of Array.from(s)) {
    const cp = c.codePointAt(0);
    w += cp !== undefined && cp >= 0x2e80 ? 2 : 1;
  }
  return w;
}

function entryWidth(entry: ChoiceEntry): number {
  return entry.kind === "text" ? displayWidth(entry.text) : IMAGE_OR_MATH_NOMINAL_WIDTH;
}

function isEntryEmpty(entry: ChoiceEntry): boolean {
  return entry.kind === "text" && entry.text.trim() === "";
}

// Empty options (a freshly-inserted question's default blanks, or a
// choice the user hasn't filled in yet) are excluded from the average so
// they don't skew the layout toward "1 column" while the user is still
// typing. An all-empty list defaults to 4 columns (the reference
// template's own starting layout for short/blank content).
export function choiceColumns(entries: ChoiceEntry[]): 1 | 2 | 4 {
  const nonEmpty = entries.filter((e) => !isEntryEmpty(e));
  if (nonEmpty.length === 0) return 4;
  const avg = nonEmpty.reduce((sum, e) => sum + entryWidth(e), 0) / nonEmpty.length;
  if (avg <= 14) return 4;
  if (avg <= 28) return 2;
  return 1;
}
