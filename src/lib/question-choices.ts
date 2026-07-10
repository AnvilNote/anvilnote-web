// Auto-layout heuristic for a question block's choices: 4-in-a-row -> 2x2
// -> 1-per-line, based on average visible character width across the
// non-empty options. Ported from the reference personal template at
// /Users/anthonysung/tutoring/english/quiz/quiz-template.typ (its own
// display-width()/choices() functions) — same thresholds (14/28), so the
// web preview and the exported PDF (anvilnote-renderer's
// templates/shared/anvil-question.typ, which ports the exact same
// algorithm) stay visually close. CJK code point (>= U+2E80) counts as 2
// display units, everything else as 1 — matches the reference template's
// own convention exactly.
export function displayWidth(s: string): number {
  let w = 0;
  for (const c of Array.from(s)) {
    const cp = c.codePointAt(0);
    w += cp !== undefined && cp >= 0x2e80 ? 2 : 1;
  }
  return w;
}

// Empty options (a freshly-inserted question's default blanks, or a
// choice the user hasn't filled in yet) are excluded from the average so
// they don't skew the layout toward "1 column" while the user is still
// typing. An all-empty list defaults to 4 columns (the reference
// template's own starting layout for short/blank content).
export function choiceColumns(options: string[]): 1 | 2 | 4 {
  const nonEmpty = options.filter((o) => o.trim() !== "");
  if (nonEmpty.length === 0) return 4;
  const avg = nonEmpty.reduce((sum, o) => sum + displayWidth(o), 0) / nonEmpty.length;
  if (avg <= 14) return 4;
  if (avg <= 28) return 2;
  return 1;
}
