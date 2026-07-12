# Table Interaction Design

## Goal

Provide a complete table editing experience: quiet when idle, contextual insert and resize controls on boundaries, rectangular cell selection with a floating command menu, and Typst-compatible table metadata.

## Interaction Model

- With no hover and no cell selection, no table editing controls are visible.
- Hovering a horizontal boundary reveals that boundary's row insert button and row resize affordance.
- Hovering a vertical boundary reveals that boundary's column insert button and column resize affordance.
- Insert controls exist before the first and after the last row/column. Resize handles exist on internal and trailing boundaries where a track can be resized.
- New tables start with equal column widths and equal row heights.
- Adding a track to an untouched table keeps all tracks equal. After manual resizing, insertion preserves existing proportions and takes space from the adjacent track.
- Dragging across cells creates a rectangular `CellSelection`. Whole rows or columns can also be selected through their boundary controls.

## Floating Menu

The table Bubble Menu appears only for a `CellSelection`. It provides:

- Merge selected rectangular cells.
- Split a merged cell.
- Delete every selected row.
- Delete every selected column.
- Set supported cell attributes on all selected cells: alignment, fill, stroke, inset, and breakability.

Commands that cannot operate on the current selection remain visible but disabled.

## Data Model

- Tiptap/ProseMirror remains the source of truth for table structure and selection.
- Standard `colspan`, `rowspan`, and `colwidth` attributes are retained.
- Row height is stored on `tableRow` as `rowHeight` in pixels.
- Typst-compatible cell attributes are registered on `tableCell` and `tableHeader`: `align`, `fill`, `stroke`, `inset`, and `breakable`.
- UI-only metadata is not serialized to Typst.

## Typst Output

- Column widths are emitted through `table(columns: (...))`.
- Row heights are emitted through `rows: (...)`.
- Merged cells emit `table.cell(colspan: ..., rowspan: ...)[...]`.
- Cell styles emit only supported `table.cell` named arguments.
- Default, unstyled, unmerged cells keep the concise `[content]` form.

## Verification

- Unit tests cover track redistribution and Typst serialization.
- Type checking, linting, and production builds cover both web and renderer repositories.
- Browser verification covers idle state, every boundary hover, click-to-insert, both resize directions, multi-cell selection, merge/split, delete row/column, and cell attributes.
