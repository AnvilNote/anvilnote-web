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
// choice the user hasn't filled in yet) are excluded from the AVERAGE so
// they don't skew the layout toward "1 column" while the user is still
// typing — but the all-empty case still reflects the actual entry COUNT
// (capped at 5, same as the short tier below), not a hardcoded 4: a
// question with 5 still-blank choices lays out as 5-in-a-row from the
// start, not 4+1, the moment the 5th one is added — matches what it'll
// look like once the user actually fills them in with short text.
//
// Column count is capped per tier against the TOTAL entry count
// (entries.length — every slot being laid out, filled or not), not the
// non-empty count. Real bug, caught via a live repro: capping against
// nonEmpty.length made the layout collapse to 1 column the instant the
// FIRST of 5 blank choices got a single character typed into it (only 1
// of 5 counted as "non-empty" at that moment, so min(1, 5) = 1) — a
// jarring flash from 5-in-a-row down to a single stacked column mid-
// keystroke. entries.length reflects how many boxes actually exist
// regardless of fill state, so 5 slots stay 5-in-a-row throughout typing;
// only the AVERAGE WIDTH (which decides which cap TIER applies) still
// excludes blanks, so a couple of empty placeholders don't skew a
// genuinely-short question toward the wrong tier.
export function choiceColumns(entries: ChoiceEntry[]): number {
  const nonEmpty = entries.filter((e) => !isEntryEmpty(e));
  if (nonEmpty.length === 0) return Math.min(entries.length, 5) || 4;
  const avg = nonEmpty.reduce((sum, e) => sum + entryWidth(e), 0) / nonEmpty.length;
  if (avg <= 14) return Math.min(entries.length, 5);
  if (avg <= 28) return Math.min(entries.length, 2);
  return 1;
}
