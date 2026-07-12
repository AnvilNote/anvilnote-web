# Table Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build boundary insertion/resizing, multi-cell table commands, Typst-compatible cell attributes, and renderer serialization.

**Architecture:** Keep ProseMirror as the structural source of truth. Move reusable track calculations into a pure helper, keep DOM boundary controls inside the existing table NodeView, place selection commands in a dedicated React Bubble Menu, and serialize the resulting JSON in `anvilnote-renderer`.

**Tech Stack:** Next.js 16, React 19, Tiptap 3/ProseMirror tables, TypeScript, Node test runner, Typst.

## Global Constraints

- Idle tables show no insertion, resize, or command UI.
- Boundary controls stay interactive while the pointer moves from the boundary to the visible button.
- New untouched tables remain equally sized; manually resized tables preserve proportions when inserting adjacent tracks.
- Only Typst-supported attributes are exported.

---

### Task 1: Track Geometry and Schema

**Files:**
- Create: `src/lib/tiptap/table-geometry.ts`
- Create: `src/lib/tiptap/table-geometry.test.ts`
- Modify: `src/lib/tiptap/extensions.ts`

**Interfaces:**
- Produces: `insertTrackSize(sizes, index, total, minimum)` and `resizeTrackPair(sizes, boundary, delta, minimum)`.
- Produces: table row `rowHeight` and Typst-compatible cell attributes.

- [ ] Write failing tests for equal insertion, proportional insertion, and minimum-size clamping.
- [ ] Run `node --test src/lib/tiptap/table-geometry.test.ts` and confirm missing-module or missing-export failures.
- [ ] Implement the pure geometry helpers.
- [ ] Run the focused test and confirm all cases pass.
- [ ] Extend `TableRow`, `TableCell`, and `TableHeader` schemas with round-trippable attributes.

### Task 2: Boundary Controls and Resize

**Files:**
- Modify: `src/lib/tiptap/extensions.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: Task 1 geometry helpers and schema attributes.
- Produces: stable row/column boundary zones, insert buttons, and drag handles.

- [ ] Add a failing geometry test for inserting next to a manually resized track.
- [ ] Replace the disappearing out-of-zone button layout with a boundary container that includes both its gutter button and resize hit area.
- [ ] Prevent NodeView controls from stealing the editor selection on pointer down.
- [ ] Use Tiptap table commands for insertion and persist resized row/column dimensions through transactions.
- [ ] Re-render boundary geometry through a `ResizeObserver` and clean it up in `destroy()`.
- [ ] Re-run focused geometry tests and web lint.

### Task 3: Cell Selection Bubble Menu

**Files:**
- Create: `src/components/editor/table-bubble-menu.tsx`
- Modify: `src/components/editor/tiptap-editor.tsx`
- Modify: `src/components/landing/landing-demo-editor.tsx`
- Modify: `src/components/app/version-preview.tsx`
- Modify: `messages/*.json`

**Interfaces:**
- Consumes: Tiptap `CellSelection` and table commands.
- Produces: merge, split, delete rows/columns, and batch cell-attribute controls.

- [ ] Gate the menu strictly on `CellSelection` and use `can()` for disabled command states.
- [ ] Add icon buttons for merge, split, delete rows, and delete columns.
- [ ] Add compact controls for alignment, fill, stroke, inset, and breakability.
- [ ] Apply attributes to every selected cell through ProseMirror transactions.
- [ ] Mount the menu in all editor surfaces and add localized labels.
- [ ] Run web lint and build.

### Task 4: Typst Serialization

**Files:**
- Create: `../anvilnote-renderer/src/converters/tiptap-table.test.ts`
- Modify: `../anvilnote-renderer/src/converters/tiptap-to-typst.ts`

**Interfaces:**
- Consumes: Tiptap table, row, cell, and header attributes.
- Produces: valid Typst `columns`, `rows`, `table.cell`, `colspan`, `rowspan`, and style arguments.

- [ ] Write failing tests for merged cells, track dimensions, supported styles, and omission of unsupported attributes.
- [ ] Run `node --import tsx --test src/converters/tiptap-table.test.ts` and confirm expected failures.
- [ ] Implement safe Typst length, color, alignment, stroke, inset, and boolean serialization.
- [ ] Preserve concise output for default cells and header semantics for styled header cells.
- [ ] Re-run renderer tests, lint, and TypeScript build.

### Task 5: End-to-End Verification

**Files:**
- Modify only files required by defects found during verification.

**Interfaces:**
- Consumes: completed web and renderer behavior.
- Produces: verified desktop and mobile table editing behavior.

- [ ] Run all focused Node tests.
- [ ] Run web lint and production build.
- [ ] Run renderer lint and TypeScript build.
- [ ] Start the web development server and verify idle, hover, insertion, resize, selection, commands, and attributes in the browser.
- [ ] Inspect the final diffs for unrelated changes and remaining debug output.
