# Question Blank (Cloze Reference) — Design

## Goal

Support cloze-style questions: a paragraph of prose with inline numbered
blanks (`____1____`), where each blank number is a live reference to a
separate `questionItem` (single/multi/written) elsewhere in the document
— mirroring `/Users/anthonysung/tutoring/english/quiz/quiz-template.typ`'s
`qblank(n)` helper, but auto-numbered instead of manually typed.

## Node & data model

New inline atom node `questionBlank` (own type, NOT a reuse of `crossRef`'s
node or NodeView — only its *pattern* is borrowed).

Attrs:
- `targetId: string | null` — id of the `questionItem` this blank refers to.
- `resolvedValue: string | null` — the target's live question number, kept
  current by the same resolver plugin that already numbers figures/tables.
- `broken: boolean` — true if `targetId` no longer resolves to any
  `questionItem` (e.g. the question was deleted).

## Numbering (reuse of `cross-ref.ts`'s resolver)

- `questionItem` is added to `cross-ref.ts`'s `TARGET_TYPES`, so it gets a
  stable backfilled `id` the same way image/table/blockMath/heading do.
- The resolver's numbering pass (pass 3 in `cross-ref.ts`) gets a new
  branch: every `questionItem`, in document order, gets a sequence number
  — unconditional, like figure/table (not gated on "is it referenced",
  unlike equations) — this is the SAME count `useQuestionNumber` already
  computes independently in `question-item-node-view.tsx`, so the two
  should never disagree.
- Pass 4 (resolving reference nodes' display values) is extended to also
  walk `questionBlank` nodes, not just `crossRef` nodes, writing
  `resolvedValue`/`broken` the same way.

## Insertion UX

Typing `#` anywhere inline opens a suggestion menu (separate Suggestion
plugin instance from cross-ref's `@`, since `#` is unused today — heading
markdown shortcuts use `# ` as an InputRule at the start of an empty line,
a different mechanism, so no collision). The menu lists every
`questionItem` in the document (question number + a short text snippet).
Picking one inserts a `questionBlank` node with `targetId` set to that
question's id.

## Rendering

`QuestionBlankNodeView`: a small inline box —
- bottom border only (the "blank line"), no left/right/top border.
- the resolved number, text-centered, baseline nudged up (matches
  `qblank`'s `baseline: 20%`).
- horizontal inset scales with digit count: `1.2em` each side for a
  single-digit number, `1em` each side once the number reaches two digits
  (≥ 10) — symmetric, same value both sides.
- `broken` state: dashed destructive-colored border instead, same visual
  language `CrossRefNodeView` already uses for its own broken state.

## Renderer scope (this pass)

- **Typst (PDF)**: `anvilnote-renderer`'s `templates/shared/anvil-question.typ`
  gets a `question-blank(n)` helper mirroring `qblank(n)`, with the
  digit-based inset rule ported over (the reference template used a fixed
  `1em` both sides; this replaces that with the 1.2em/1em split).
  `tiptap-to-typst.ts` gets a `case "questionBlank"` that resolves the
  node's `resolvedValue` (or re-derives it defensively if absent) and
  calls `#question-blank(n)`.
- **DOCX / Markdown**: out of scope this pass — `questionBlank` degrades to
  plain inline text `(N)` in both exporters. No new OOXML/markdown
  helpers.

## Explicitly out of scope

- No answer-choice UI change — a `questionBlank`'s target `questionItem`
  is a completely normal question block (single/multi/written), rendered
  wherever it naturally sits in the document; cloze mode is purely about
  how the *reference* looks inline in prose, not a new question kind.
- No cross-document references — `targetId` only ever resolves within the
  same document, exactly like `crossRef`.
