import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Document from "@tiptap/extension-document";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Footnotes, Footnote, FootnoteReference } from "tiptap-footnotes";
import { FootnotesNodeView } from "@/components/editor/node-views/footnotes-node-view";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Table, TableView } from "@tiptap/extension-table";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  CellSelection,
  TableMap,
} from "@tiptap/pm/tables";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Mathematics } from "@tiptap/extension-mathematics";
import { BlockMathExit, MathArrowSelect } from "@/lib/tiptap/math";
import { AnvilBlockquote } from "@/lib/tiptap/blockquote";
import { AnvilCodeBlock } from "@/lib/tiptap/code-block";
import { AnvilImage } from "@/lib/tiptap/image";
import { AnvilCallout } from "@/lib/tiptap/callout";
import { AnvilProof } from "@/lib/tiptap/proof";
import { AnvilMermaid } from "@/lib/tiptap/mermaid";
import { AnvilFunctionPlot } from "./function-plot";
import { AnvilStatsChart } from "./stats-chart";
import { AnvilQuestion, AnvilQuestionItem, AnvilChoiceList, AnvilChoiceItem } from "./question";
import { AnvilImageRow } from "@/lib/tiptap/image-row";
import { CrossRef, CrossRefTargetIds } from "@/lib/tiptap/cross-ref";
import { CrossRefSuggestion } from "@/components/editor/cross-ref-suggestion";
import { QuestionBlank } from "@/lib/tiptap/question-blank";
import { QuestionBlankSuggestion } from "@/components/editor/question-blank-suggestion";
import { InlineBlank } from "@/lib/tiptap/inline-blank";
import { TabNavigation } from "@/lib/tiptap/tab-navigation";
import { AnvilDivider } from "@/lib/tiptap/divider";
import { captionHasMath, renderCaptionHtml } from "@/lib/tiptap/caption-math";
import { insertTrackSize, resizeTrackPair } from "@/lib/tiptap/table-geometry";
import {
  contrastTextColor,
  normalizeCellBoolean,
  normalizeCellColor,
  normalizeCellInset,
  normalizeCellVerticalAlign,
} from "@/lib/tiptap/table-attributes";

export type TableVariant = "normal" | "three-line";
export type TableAlign = "left" | "center" | "right";

const MIN_COLUMN_WIDTH = 48;
// 0.45cm at CSS 96dpi (0.45 / 2.54 * 96 ≈ 17px) — the Word-like default/
// minimum row height; drag-resizing can shrink a row back down to exactly
// the default but no further.
const MIN_ROW_HEIGHT = 17;

class AnvilTableView extends TableView {
  private readonly viewInstance;
  private readonly captionInput: HTMLInputElement;
  // Shown instead of captionInput whenever the caption has $$...$$ math and
  // isn't currently focused for editing — mirrors caption-input.tsx's React
  // version (image captions), reimplemented with plain DOM here since
  // AnvilTableView is a vanilla TableView subclass, not a React NodeView.
  private readonly captionDisplay: HTMLDivElement;
  private tableInner!: HTMLDivElement;
  private addRowLabel = "Add row";
  private addColumnLabel = "Add column";
  private resizeRowLabel = "Resize row";
  private resizeColumnLabel = "Resize column";
  private rowGutterZones: HTMLDivElement[] = [];
  private colGutterZones: HTMLDivElement[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private renderFrame: number | null = null;
  private stopActiveResize: (() => void) | null = null;

  constructor(
    node: import("@tiptap/pm/model").Node,
    cellMinWidth: number,
    view: import("@tiptap/pm/view").EditorView,
    HTMLAttributes: Record<string, unknown> = {},
  ) {
    super(node, cellMinWidth, view, HTMLAttributes);
    this.viewInstance = view;

    const captionLabel =
      typeof HTMLAttributes["data-caption-label"] === "string"
        ? HTMLAttributes["data-caption-label"]
        : "Table";
    const captionPlaceholder =
      typeof HTMLAttributes["data-caption-placeholder"] === "string"
        ? HTMLAttributes["data-caption-placeholder"]
        : "Caption";
    const deleteLabel =
      typeof HTMLAttributes["data-delete-label"] === "string"
        ? HTMLAttributes["data-delete-label"]
        : "Delete";
    const addRowLabel =
      typeof HTMLAttributes["data-add-row-label"] === "string"
        ? HTMLAttributes["data-add-row-label"]
        : "Add row";
    const addColumnLabel =
      typeof HTMLAttributes["data-add-column-label"] === "string"
        ? HTMLAttributes["data-add-column-label"]
        : "Add column";
    const resizeRowLabel =
      typeof HTMLAttributes["data-resize-row-label"] === "string"
        ? HTMLAttributes["data-resize-row-label"]
        : "Resize row";
    const resizeColumnLabel =
      typeof HTMLAttributes["data-resize-column-label"] === "string"
        ? HTMLAttributes["data-resize-column-label"]
        : "Resize column";

    // Vanilla DOM delete button — same bottom-right corner pattern as
    // callout/proof/codeBlock/mermaid's own React NodeView delete buttons,
    // hand-rolled here since AnvilTableView is a plain TableView subclass,
    // not a React NodeView. Icon markup copied verbatim from lucide-react's
    // own Trash2 SVG (no lucide-react import available in vanilla DOM code).
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "anvil-table__delete";
    deleteButton.setAttribute("aria-label", deleteLabel);
    deleteButton.title = deleteLabel;
    deleteButton.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    deleteButton.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    deleteButton.addEventListener("click", () => {
      this.deleteTable();
    });

    const caption = document.createElement("div");
    caption.className = "anvil-table__caption";
    caption.contentEditable = "false";

    const label = document.createElement("span");
    label.className = "anvil-table__caption-label";
    label.setAttribute("data-label", captionLabel);

    this.captionInput = document.createElement("input");
    this.captionInput.type = "text";
    this.captionInput.className = "anvil-caption-input";
    this.captionInput.placeholder = captionPlaceholder;
    this.captionInput.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    this.captionInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
    });
    this.captionInput.addEventListener("input", () => {
      this.updateCaption(this.captionInput.value);
    });
    this.captionInput.addEventListener("blur", () => {
      this.updateCaption(this.captionInput.value);
      this.syncCaptionDisplayMode();
    });

    this.captionDisplay = document.createElement("div");
    this.captionDisplay.className = "anvil-caption-input";
    this.captionDisplay.tabIndex = 0;
    this.captionDisplay.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    this.captionDisplay.addEventListener("click", () => {
      this.captionDisplay.hidden = true;
      this.captionInput.hidden = false;
      this.captionInput.focus();
    });

    caption.append(label, this.captionInput, this.captionDisplay);

    this.addRowLabel = addRowLabel;
    this.addColumnLabel = addColumnLabel;
    this.resizeRowLabel = resizeRowLabel;
    this.resizeColumnLabel = resizeColumnLabel;

    // The base TableView constructor already appended `this.table` directly
    // into `this.dom` — reparent it into a dedicated inner wrapper so the
    // row/column insert buttons (see renderGutters below) can be
    // positioned relative to the TABLE's own edges specifically, not
    // `this.dom`'s (which also contains the caption below the table).
    const tableInner = document.createElement("div");
    tableInner.className = "anvil-table__inner";
    tableInner.appendChild(this.table);
    this.tableInner = tableInner;
    this.dom.insertBefore(tableInner, this.dom.firstChild);
    this.dom.append(caption, deleteButton);

    this.syncWrapperAttrs();
    // getBoundingClientRect() on the row/column gutter buttons needs real
    // layout, which doesn't exist yet mid-constructor (the DOM isn't
    // attached to the document until the caller inserts this.dom) —
    // deferred one frame past the initial synchronous mount.
    this.requestGutterRender();
    this.resizeObserver = new ResizeObserver(() => this.requestGutterRender());
    this.resizeObserver.observe(this.table);
  }

  private requestGutterRender() {
    if (this.renderFrame !== null) cancelAnimationFrame(this.renderFrame);
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = null;
      this.renderGutters();
    });
  }

  private renderGutters() {
    this.rowGutterZones.forEach((element) => element.remove());
    this.colGutterZones.forEach((element) => element.remove());
    this.rowGutterZones = [];
    this.colGutterZones = [];

    const rows = Array.from(this.table.tBodies[0]?.rows ?? []);
    if (rows.length === 0) return;
    const tableRect = this.table.getBoundingClientRect();

    const makeZone = (
      axis: "row" | "column",
      boundaryIndex: number,
      zoneClassName: string,
      buttonClassName: string,
      label: string,
      onClick: () => void,
    ): HTMLDivElement => {
      const zone = document.createElement("div");
      zone.className = zoneClassName;
      zone.contentEditable = "false";
      zone.dataset.boundary = String(boundaryIndex);

      const button = document.createElement("button");
      button.type = "button";
      button.className = buttonClassName;
      button.setAttribute("aria-label", label);
      button.title = label;
      button.textContent = "+";
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.viewInstance.focus();
        onClick();
      });

      zone.append(button);
      if (boundaryIndex > 0) {
        const resizeButton = document.createElement("button");
        resizeButton.type = "button";
        resizeButton.className = "anvil-table__boundary-resize";
        const resizeLabel = axis === "row" ? this.resizeRowLabel : this.resizeColumnLabel;
        resizeButton.setAttribute("aria-label", resizeLabel);
        resizeButton.title = resizeLabel;
        resizeButton.addEventListener("pointerdown", (event) => {
          this.startBoundaryResize(axis, boundaryIndex, event);
        });
        resizeButton.addEventListener("keydown", (event) => {
          const delta =
            axis === "column"
              ? event.key === "ArrowLeft"
                ? -8
                : event.key === "ArrowRight"
                  ? 8
                  : 0
              : event.key === "ArrowUp"
                ? -8
                : event.key === "ArrowDown"
                  ? 8
                  : 0;
          if (delta !== 0) {
            event.preventDefault();
            event.stopPropagation();
            this.resizeBoundary(axis, boundaryIndex, delta);
          }
        });
        zone.append(resizeButton);
      }

      this.tableInner.appendChild(zone);
      return zone;
    };

    // Zones are absolutely positioned inside tableInner, but every offset
    // below is measured relative to the TABLE's own rect — the two only
    // coincide while the table fills the wrapper. Once the table has an
    // explicit total width narrower than the wrapper (e.g. after dragging
    // the rightmost boundary inward), data-align="center"'s margin-inline:
    // auto shifts the table right of the wrapper's left edge and every
    // zone would otherwise land misaligned, making the visual boundaries
    // un-hoverable. Add the table's offset within the wrapper to both
    // axes, and pin row zones to the table's actual width instead of the
    // CSS default left:0/right:0 wrapper span.
    const innerRect = this.tableInner.getBoundingClientRect();
    const tableOffsetX = tableRect.left - innerRect.left;
    const tableOffsetY = tableRect.top - innerRect.top;

    const rowOffsets = [0];
    for (const row of rows) {
      rowOffsets.push(row.getBoundingClientRect().bottom - tableRect.top);
    }
    rowOffsets.forEach((offset, boundaryIndex) => {
      const zone = makeZone(
        "row",
        boundaryIndex,
        "anvil-table__row-zone",
        "anvil-table__row-insert",
        this.addRowLabel,
        () => this.insertRowAtBoundary(boundaryIndex),
      );
      zone.style.top = `${tableOffsetY + offset}px`;
      zone.style.left = `${tableOffsetX}px`;
      zone.style.right = "auto";
      zone.style.width = `${tableRect.width}px`;
      this.rowGutterZones.push(zone);
    });

    const columnWidths = this.measureColumnWidths();
    const columnOffsets = [0];
    for (const width of columnWidths) {
      columnOffsets.push(columnOffsets[columnOffsets.length - 1] + width);
    }
    columnOffsets.forEach((offset, boundaryIndex) => {
      const zone = makeZone(
        "column",
        boundaryIndex,
        "anvil-table__col-zone",
        "anvil-table__col-insert",
        this.addColumnLabel,
        () => this.insertColumnAtBoundary(boundaryIndex),
      );
      zone.style.left = `${tableOffsetX + offset}px`;
      zone.style.top = `${tableOffsetY}px`;
      zone.style.bottom = "auto";
      zone.style.height = `${tableRect.height}px`;
      this.colGutterZones.push(zone);
    });
  }

  private insertRowAtBoundary(boundaryIndex: number) {
    const table = this.findTablePos();
    if (!table) return;
    const rowCount = table.node.childCount;
    if (rowCount === 0 || boundaryIndex < 0 || boundaryIndex > rowCount) return;
    const manual = Array.from({ length: rowCount }, (_, index) =>
      Number(table.node.child(index).attrs.rowHeight),
    ).some((height) => Number.isFinite(height) && height > 0);
    const sizes = manual ? this.measureRowHeights() : [];
    const total = sizes.reduce((sum, size) => sum + size, 0);
    const rowIndex = boundaryIndex === rowCount ? rowCount - 1 : boundaryIndex;
    const side = boundaryIndex === rowCount ? "after" : "before";
    const cellPos = this.firstCellPosInRow(table.pos, table.node, rowIndex);
    if (cellPos === null) return;
    const { state, dispatch } = this.viewInstance;
    dispatch(state.tr.setSelection(CellSelection.create(state.doc, cellPos)));
    (side === "before" ? addRowBefore : addRowAfter)(
      this.viewInstance.state,
      this.viewInstance.dispatch,
    );
    if (manual) {
      this.setRowHeights(
        insertTrackSize(sizes, boundaryIndex, total, MIN_ROW_HEIGHT),
      );
    }
    this.requestGutterRender();
  }

  private insertColumnAtBoundary(boundaryIndex: number) {
    const table = this.findTablePos();
    if (!table) return;
    const columnCount = TableMap.get(table.node).width;
    if (columnCount === 0 || boundaryIndex < 0 || boundaryIndex > columnCount) return;
    let manual = false;
    table.node.descendants((node) => {
      if (
        (node.type.name === "tableCell" || node.type.name === "tableHeader") &&
        Array.isArray(node.attrs.colwidth) &&
        node.attrs.colwidth.some((width: unknown) => typeof width === "number" && width > 0)
      ) {
        manual = true;
        return false;
      }
      return true;
    });
    const sizes = manual ? this.measureColumnWidths() : [];
    const total = sizes.reduce((sum, size) => sum + size, 0);
    const colIndex = boundaryIndex === columnCount ? columnCount - 1 : boundaryIndex;
    const side = boundaryIndex === columnCount ? "after" : "before";
    const cellPos = this.cellPosInFirstRow(table.pos, table.node, colIndex);
    if (cellPos === null) return;
    const { state, dispatch } = this.viewInstance;
    dispatch(state.tr.setSelection(CellSelection.create(state.doc, cellPos)));
    (side === "before" ? addColumnBefore : addColumnAfter)(
      this.viewInstance.state,
      this.viewInstance.dispatch,
    );
    if (manual) {
      this.setColumnWidths(
        insertTrackSize(sizes, boundaryIndex, total, MIN_COLUMN_WIDTH),
      );
    }
    this.requestGutterRender();
  }

  private measureColumnWidths() {
    const table = this.findTablePos();
    if (!table) return [];
    const count = TableMap.get(table.node).width;
    const tableWidth = this.table.getBoundingClientRect().width;
    const measured = Array.from(this.colgroup.children, (column) =>
      column.getBoundingClientRect().width,
    );
    if (measured.length === count && measured.every((width) => width > 0)) {
      return measured;
    }
    return Array<number>(count).fill(tableWidth / Math.max(count, 1));
  }

  private measureRowHeights() {
    return Array.from(this.table.tBodies[0]?.rows ?? [], (row) =>
      row.getBoundingClientRect().height,
    );
  }

  private setColumnWidths(widths: number[]) {
    const table = this.findTablePos();
    if (!table) return;
    const map = TableMap.get(table.node);
    if (widths.length !== map.width) return;
    const { state, dispatch } = this.viewInstance;
    const tr = state.tr;
    const start = table.pos + 1;
    for (let column = 0; column < map.width; column += 1) {
      const width = Math.max(MIN_COLUMN_WIDTH, Math.round(widths[column]));
      for (let row = 0; row < map.height; row += 1) {
        const mapIndex = row * map.width + column;
        if (row > 0 && map.map[mapIndex] === map.map[mapIndex - map.width]) continue;
        const relativePos = map.map[mapIndex];
        const cell = table.node.nodeAt(relativePos);
        if (!cell) continue;
        const cellColumn = map.colCount(relativePos);
        const widthIndex = cell.attrs.colspan === 1 ? 0 : column - cellColumn;
        const colwidth = Array.isArray(cell.attrs.colwidth)
          ? [...cell.attrs.colwidth]
          : Array<number>(cell.attrs.colspan).fill(0);
        if (colwidth[widthIndex] === width) continue;
        colwidth[widthIndex] = width;
        tr.setNodeMarkup(start + relativePos, undefined, { ...cell.attrs, colwidth });
      }
    }
    if (tr.docChanged) dispatch(tr);
  }

  private setRowHeights(heights: number[]) {
    const table = this.findTablePos();
    if (!table || heights.length !== table.node.childCount) return;
    const tr = this.viewInstance.state.tr;
    let rowPos = table.pos + 1;
    for (let index = 0; index < table.node.childCount; index += 1) {
      const row = table.node.child(index);
      const rowHeight = Math.max(MIN_ROW_HEIGHT, Math.round(heights[index]));
      if (row.attrs.rowHeight !== rowHeight) {
        tr.setNodeMarkup(rowPos, undefined, { ...row.attrs, rowHeight });
      }
      rowPos += row.nodeSize;
    }
    if (tr.docChanged) this.viewInstance.dispatch(tr);
  }

  // Resolves the sizes a drag/nudge should produce. Columns growing the
  // table via the LAST boundary are capped so the table's total width never
  // exceeds the wrapper's (= the text column's) width — shrinking below it
  // is fine, growing past it is not, per explicit product decision. Internal
  // boundaries redistribute between two tracks (total unchanged), so only
  // the last-boundary case can change the total at all.
  private computeResizedSizes(
    axis: "row" | "column",
    boundaryIndex: number,
    sizes: number[],
    delta: number,
  ): number[] {
    const minimum = axis === "row" ? MIN_ROW_HEIGHT : MIN_COLUMN_WIDTH;
    if (boundaryIndex === sizes.length) {
      const next = [...sizes];
      let target = Math.max(minimum, next[next.length - 1] + delta);
      if (axis === "column") {
        const others = next.slice(0, -1).reduce((sum, size) => sum + size, 0);
        const maxTotal = this.tableInner.getBoundingClientRect().width;
        target = Math.min(target, Math.max(minimum, maxTotal - others));
      }
      next[next.length - 1] = target;
      return next;
    }
    return resizeTrackPair(sizes, boundaryIndex - 1, delta, minimum);
  }

  // Live preview during a drag writes ONLY to the DOM (colgroup widths /
  // row heights), no transactions — the single real transaction lands on
  // pointerup, so the whole drag is ONE undo step instead of one per
  // mousemove (which made Ctrl+Z crawl back through every intermediate
  // pixel of the drag).
  private previewSizes(axis: "row" | "column", sizes: number[]) {
    if (axis === "column") {
      const cols = Array.from(this.colgroup.children) as HTMLElement[];
      sizes.forEach((size, index) => {
        if (cols[index]) cols[index].style.width = `${Math.round(size)}px`;
      });
      this.table.style.width = `${Math.round(sizes.reduce((sum, s) => sum + s, 0))}px`;
    } else {
      const rows = Array.from(this.table.tBodies[0]?.rows ?? []);
      sizes.forEach((size, index) => {
        if (rows[index]) rows[index].style.height = `${Math.round(size)}px`;
      });
    }
  }

  private commitSizes(axis: "row" | "column", sizes: number[]) {
    if (axis === "row") this.setRowHeights(sizes);
    else this.setColumnWidths(sizes);
  }

  private resizeBoundary(axis: "row" | "column", boundaryIndex: number, delta: number) {
    const sizes = axis === "row" ? this.measureRowHeights() : this.measureColumnWidths();
    if (boundaryIndex <= 0 || boundaryIndex > sizes.length) return;
    this.commitSizes(axis, this.computeResizedSizes(axis, boundaryIndex, sizes, delta));
  }

  private startBoundaryResize(
    axis: "row" | "column",
    boundaryIndex: number,
    event: PointerEvent,
  ) {
    event.preventDefault();
    event.stopPropagation();
    this.stopActiveResize?.();
    this.viewInstance.focus();

    const start = axis === "row" ? event.clientY : event.clientX;
    const sizes = axis === "row" ? this.measureRowHeights() : this.measureColumnWidths();
    const bodyClass = axis === "row" ? "anvil-resize-row" : "anvil-resize-column";
    document.body.classList.add(bodyClass);
    let lastDelta = 0;

    const move = (moveEvent: PointerEvent) => {
      const current = axis === "row" ? moveEvent.clientY : moveEvent.clientX;
      lastDelta = current - start;
      this.previewSizes(
        axis,
        this.computeResizedSizes(axis, boundaryIndex, sizes, lastDelta),
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.classList.remove(bodyClass);
      this.stopActiveResize = null;
      if (lastDelta !== 0) {
        this.commitSizes(
          axis,
          this.computeResizedSizes(axis, boundaryIndex, sizes, lastDelta),
        );
      }
      this.requestGutterRender();
    };
    this.stopActiveResize = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  }

  // addRowBefore/After and addColumnBefore/After (from @tiptap/pm/tables)
  // all act relative to the CURRENT selection, not a target position —
  // ANY cell within the target row/column is a valid anchor (the command
  // operates on the whole row/column regardless of which cell in it is
  // selected), so these only need to find one.
  private firstCellPosInRow(
    tablePos: number,
    tableNode: import("@tiptap/pm/model").Node,
    rowIndex: number,
  ): number | null {
    if (rowIndex < 0 || rowIndex >= tableNode.childCount) return null;
    let pos = tablePos + 1;
    for (let i = 0; i < rowIndex; i += 1) {
      pos += tableNode.child(i).nodeSize;
    }
    // pos is now the row's own start; +1 enters the row to its first cell.
    return tableNode.child(rowIndex).childCount > 0 ? pos + 1 : null;
  }

  private cellPosInFirstRow(
    tablePos: number,
    tableNode: import("@tiptap/pm/model").Node,
    colIndex: number,
  ): number | null {
    if (tableNode.childCount === 0) return null;
    const firstRow = tableNode.child(0);
    if (colIndex < 0 || colIndex >= firstRow.childCount) return null;
    let pos = tablePos + 1 + 1;
    for (let i = 0; i < colIndex; i += 1) {
      pos += firstRow.child(i).nodeSize;
    }
    return pos;
  }

  // Shared by appendRow/appendColumn below — same "search DOM candidates
  // for this table's own document position" technique deleteTable/
  // updateCaption already use, resolved once here since both new methods
  // need it.
  private findTablePos(): { pos: number; node: import("@tiptap/pm/model").Node } | null {
    const domCandidates: Node[] = [this.dom, this.table, this.contentDOM];

    for (const dom of domCandidates) {
      try {
        const domPos = this.viewInstance.posAtDOM(dom, 0);
        for (const candidate of [domPos, domPos - 1, domPos + 1]) {
          if (candidate < 0 || candidate > this.viewInstance.state.doc.content.size) {
            continue;
          }
          const resolved = this.viewInstance.state.doc.resolve(candidate);
          for (let depth = resolved.depth; depth >= 0; depth -= 1) {
            const target = resolved.node(depth);
            if (target.type === this.node.type) {
              const pos = depth === 0 ? 0 : resolved.before(depth);
              return { pos, node: target };
            }
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }


  // Same "search up from a DOM position for the ancestor node matching
  // this.node.type" approach as updateCaption below — the only way to find
  // this table's own current document position from inside a vanilla
  // NodeView, which isn't handed its position directly the way a React
  // NodeView's deleteNode prop already resolves it.
  private deleteTable() {
    const domCandidates: Node[] = [this.dom, this.table, this.contentDOM];

    for (const dom of domCandidates) {
      try {
        const domPos = this.viewInstance.posAtDOM(dom, 0);
        for (const candidate of [domPos, domPos - 1, domPos + 1]) {
          if (candidate < 0 || candidate > this.viewInstance.state.doc.content.size) {
            continue;
          }
          const resolved = this.viewInstance.state.doc.resolve(candidate);
          for (let depth = resolved.depth; depth >= 0; depth -= 1) {
            const target = resolved.node(depth);
            if (target.type === this.node.type) {
              const pos = depth === 0 ? 0 : resolved.before(depth);
              this.viewInstance.dispatch(
                this.viewInstance.state.tr.delete(pos, pos + target.nodeSize),
              );
              return;
            }
          }
        }
      } catch {
        continue;
      }
    }
  }

  override update(node: import("@tiptap/pm/model").Node) {
    const updated = super.update(node);
    if (updated) {
      this.syncWrapperAttrs();
      this.requestGutterRender();
    }
    return updated;
  }

  stopEvent(event: Event) {
    const target = event.target;
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          ".anvil-table__row-zone, .anvil-table__col-zone, .anvil-table__caption, .anvil-table__delete",
        ),
      )
    );
  }

  destroy() {
    this.stopActiveResize?.();
    this.resizeObserver?.disconnect();
    if (this.renderFrame !== null) cancelAnimationFrame(this.renderFrame);
  }

  private syncWrapperAttrs() {
    const caption =
      typeof this.node.attrs.caption === "string" ? this.node.attrs.caption : "";
    const align =
      this.node.attrs.align === "left" || this.node.attrs.align === "right"
        ? this.node.attrs.align
        : "center";

    this.dom.setAttribute("data-align", align);
    // The base TableView only applies renderHTML attributes to the <table>
    // element at CONSTRUCTION — its update() never re-applies them, so a
    // variant/align switch from the toolbar (updateAttributes on the node)
    // otherwise never reaches the DOM and the three-line CSS preview
    // (globals.css's table[data-variant="three-line"] rules) never fires.
    const variant = this.node.attrs.variant === "three-line" ? "three-line" : "normal";
    this.table.setAttribute("data-variant", variant);
    this.table.setAttribute("data-align", align);
    if (
      document.activeElement !== this.captionInput &&
      this.captionInput.value !== caption
    ) {
      this.captionInput.value = caption;
    }
    this.syncCaptionDisplayMode();
  }

  // Shows captionDisplay (KaTeX-rendered) instead of captionInput whenever
  // the caption has $$...$$ math and isn't the currently-focused input —
  // matches caption-input.tsx's "never leaves <input> mode for plain-text
  // captions" behavior: a caption with no math segment always keeps the
  // plain input visible, no click-to-edit step to discover.
  private syncCaptionDisplayMode() {
    if (document.activeElement === this.captionInput) return;
    const caption = this.captionInput.value;
    const showDisplay = caption.length > 0 && captionHasMath(caption);
    this.captionDisplay.hidden = !showDisplay;
    this.captionInput.hidden = showDisplay;
    if (showDisplay) {
      this.captionDisplay.innerHTML = renderCaptionHtml(caption);
    }
  }

  private updateCaption(caption: string) {
    const domCandidates: Node[] = [this.dom, this.table, this.contentDOM];

    for (const dom of domCandidates) {
      try {
        const domPos = this.viewInstance.posAtDOM(dom, 0);
        for (const candidate of [domPos, domPos - 1, domPos + 1]) {
          if (candidate < 0 || candidate > this.viewInstance.state.doc.content.size) {
            continue;
          }
          const resolved = this.viewInstance.state.doc.resolve(candidate);
          for (let depth = resolved.depth; depth >= 0; depth -= 1) {
            const target = resolved.node(depth);
            if (target.type === this.node.type) {
              const pos = depth === 0 ? 0 : resolved.before(depth);
              this.viewInstance.dispatch(
                this.viewInstance.state.tr.setNodeMarkup(pos, undefined, {
                  ...target.attrs,
                  caption,
                }),
              );
              return;
            }
          }
        }
      } catch {
        continue;
      }
    }
  }
}

function createAnvilTableView(
  captionLabel: string,
  captionPlaceholder: string,
  deleteLabel: string,
  addRowLabel: string,
  addColumnLabel: string,
  resizeRowLabel: string,
  resizeColumnLabel: string,
) {
  return class extends AnvilTableView {
    constructor(
      node: import("@tiptap/pm/model").Node,
      cellMinWidth: number,
      view: import("@tiptap/pm/view").EditorView,
      HTMLAttributes: Record<string, unknown> = {},
    ) {
      super(node, cellMinWidth, view, {
        ...HTMLAttributes,
        "data-caption-label": captionLabel,
        "data-caption-placeholder": captionPlaceholder,
        "data-delete-label": deleteLabel,
        "data-add-row-label": addRowLabel,
        "data-add-column-label": addColumnLabel,
        "data-resize-row-label": resizeRowLabel,
        "data-resize-column-label": resizeColumnLabel,
      });
    }
  };
}

// Table extended with two AnvilNote attributes the renderer reads:
//   variant — "normal" (full ruled grid) | "three-line" (booktabs 三線表)
//   align   — horizontal placement of the table block on the page
// Both round-trip through data-* attributes so they survive serialization and
// drive the in-editor CSS preview.
const AnvilTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") ?? "",
        renderHTML: (attributes) =>
          attributes.caption ? { "data-caption": attributes.caption } : {},
      },
      variant: {
        default: "normal",
        parseHTML: (element) => element.getAttribute("data-variant") ?? "normal",
        renderHTML: (attributes) => ({ "data-variant": attributes.variant }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") ?? "center",
        renderHTML: (attributes) => ({ "data-align": attributes.align }),
      },
    };
  },
});

const AnvilTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      rowHeight: {
        default: null,
        parseHTML: (element) => {
          const value = Number(element.getAttribute("data-row-height"));
          return Number.isFinite(value) && value >= MIN_ROW_HEIGHT ? value : null;
        },
        renderHTML: (attributes) => {
          const value = Number(attributes.rowHeight);
          return Number.isFinite(value) && value >= MIN_ROW_HEIGHT
            ? { "data-row-height": value, style: `height: ${value}px` }
            : {};
        },
      },
    };
  },
});

function anvilCellAttributes() {
  return {
    fill: {
      default: null,
      parseHTML: (element: HTMLElement) =>
        normalizeCellColor(element.getAttribute("data-cell-fill")),
      renderHTML: (attributes: Record<string, unknown>) => {
        const value = normalizeCellColor(attributes.fill);
        // Text flips black/white by the fill's WCAG relative luminance —
        // see contrastTextColor's own comment for the math.
        return value
          ? {
              "data-cell-fill": value,
              style: `background-color: ${value}; color: ${contrastTextColor(value)}`,
            }
          : {};
      },
    },
    stroke: {
      default: null,
      parseHTML: (element: HTMLElement) =>
        normalizeCellColor(element.getAttribute("data-cell-stroke")),
      renderHTML: (attributes: Record<string, unknown>) => {
        const value = normalizeCellColor(attributes.stroke);
        return value
          ? { "data-cell-stroke": value, style: `border-color: ${value}` }
          : {};
      },
    },
    inset: {
      default: null,
      parseHTML: (element: HTMLElement) =>
        normalizeCellInset(element.getAttribute("data-cell-inset")),
      renderHTML: (attributes: Record<string, unknown>) => {
        const value = normalizeCellInset(attributes.inset);
        return value
          ? { "data-cell-inset": value, style: `padding: ${value}` }
          : {};
      },
    },
    breakable: {
      default: null,
      parseHTML: (element: HTMLElement) =>
        normalizeCellBoolean(element.getAttribute("data-cell-breakable")),
      renderHTML: (attributes: Record<string, unknown>) => {
        const value = normalizeCellBoolean(attributes.breakable);
        return value === null ? {} : { "data-cell-breakable": String(value) };
      },
    },
    verticalAlign: {
      default: null,
      parseHTML: (element: HTMLElement) =>
        normalizeCellVerticalAlign(
          element.getAttribute("data-cell-vertical-align") ||
            element.style.verticalAlign,
        ),
      renderHTML: (attributes: Record<string, unknown>) => {
        const value = normalizeCellVerticalAlign(attributes.verticalAlign);
        return value
          ? {
              "data-cell-vertical-align": value,
              style: `vertical-align: ${value}`,
            }
          : {};
      },
    },
  };
}

const AnvilTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...anvilCellAttributes() };
  },
});

const AnvilTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...anvilCellAttributes() };
  },
});

// The footnotes list (tiptap-footnotes' `Footnotes` node) has to be a
// trailing sibling of the document's regular content, not nested inside it —
// hence the custom top-level Document schema instead of StarterKit's default
// "block+". StarterKit's own `document` is disabled below to avoid a
// duplicate-node-name registration.
const AnvilDocument = Document.extend({
  content: "block+ footnotes?",
});

// Pins itself to the bottom of the editor column via CSS — see
// footnotes-node-view.tsx.
const AnvilFootnotes = Footnotes.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FootnotesNodeView);
  },
});

// The package defaults a footnote's content to "paragraph+" (no block math,
// code blocks, lists, etc.); widen it to also allow blockMath so users can
// write display equations inside a footnote, matching what inlineMath
// already allows for free (it's in paragraph's own "inline*" content).
const AnvilFootnote = Footnote.configure({
  content: "(paragraph | blockMath)+",
});

export type MathClickMode = "inline" | "block";

// Same labeling convention as choice-item-node-view.tsx/choice-list-node-view.tsx.
const CHOICE_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export type BuildExtensionsOptions = {
  placeholder: string;
  figureLabel: string;
  tableLabel: string;
  figureCaptionPlaceholder: string;
  tableCaptionPlaceholder: string;
  tableDeleteLabel: string;
  tableAddRowLabel: string;
  tableAddColumnLabel: string;
  tableResizeRowLabel: string;
  tableResizeColumnLabel: string;
  // Question block placeholders — a fresh questionItem/choiceItem starts
  // as an empty paragraph, same as any other empty paragraph in the
  // document, so distinguishing them needs the Placeholder extension's
  // own per-node function form (see below), not just a single global
  // string. choicePlaceholder is a function, not a plain string — per
  // explicit feedback each choice's placeholder names its own letter
  // ("Choice A", "Choice B", ...), not a generic "Enter a choice" for
  // every one.
  questionBodyPlaceholder: string;
  choicePlaceholder: (label: string) => string;
  // A table cell starts as an empty paragraph too — same reasoning as
  // questionBodyPlaceholder above, but short (the generic `placeholder`
  // sentence overflows/wraps awkwardly in a narrow cell). Header vs. body
  // cells get their own text since they mean different things.
  tableHeaderPlaceholder: string;
  tableCellPlaceholder: string;
  // Called when a rendered formula is clicked, so the editor can open the math
  // dialog seeded with the existing LaTeX and its document position (and, for
  // block math, its optional cross-ref display name).
  onMathClick: (mode: MathClickMode, pos: number, latex: string, refName?: string) => void;
};

export function buildExtensions({
  placeholder,
  figureLabel,
  tableLabel,
  figureCaptionPlaceholder,
  tableCaptionPlaceholder,
  tableDeleteLabel,
  tableAddRowLabel,
  tableAddColumnLabel,
  tableResizeRowLabel,
  tableResizeColumnLabel,
  questionBodyPlaceholder,
  choicePlaceholder,
  tableHeaderPlaceholder,
  tableCellPlaceholder,
  onMathClick,
}: BuildExtensionsOptions): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Replaced by CodeBlockLowlight below for syntax highlighting.
      codeBlock: false,
      // Replaced by AnvilDocument below so the footnotes list can live as a
      // trailing sibling of the document's regular content.
      document: false,
      // Replaced by AnvilBlockquote below, which adds author/source
      // attribution attrs + a NodeView on top of the same node
      // name/content/commands/keyboard shortcuts/input rules.
      blockquote: false,
      // Replaced by AnvilDivider below, which adds thickness/line-style
      // attrs on top of the same node name/content/commands/keyboard
      // shortcuts/input rules.
      horizontalRule: false,
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      },
    }),
    AnvilDocument,
    AnvilBlockquote,
    AnvilDivider,
    AnvilFootnotes,
    AnvilFootnote,
    FootnoteReference,
    // A fresh questionItem's own body paragraph and a fresh choiceItem's
    // own paragraph both start out as an ordinary EMPTY paragraph —
    // indistinguishable from any other empty paragraph in the document
    // by node type alone. Placeholder's `placeholder` option accepts a
    // function ({ editor, node, pos, hasAnchor }) => string instead of a
    // plain string for exactly this "different empty-state text
    // depending on context" case.
    //
    // Two real bugs found via live testing after the first version of
    // this shipped:
    //
    // 1. `showOnlyCurrent: true` (the extension's own default) resolves
    // WHICH node counts as "the current one" via `doc.resolve(anchor)
    // .node(1)` — the ancestor at DEPTH 1, i.e. a direct child of the
    // top-level doc. For a shallow document that's the paragraph itself,
    // so the default works for ordinary body text. But a question
    // body/choice paragraph sits several levels deep (doc > question >
    // questionItem > choiceList? > choiceItem? > paragraph), so
    // `node(1)` resolves to the outer "question" block instead — which
    // isn't a textblock, so the built-in check silently produces NO
    // decoration at all. Nothing ever showed, focused or not.
    //
    // 2. Per explicit feedback, question/choice placeholders must show
    // ALWAYS while empty (not gated on focus at all) — matching a live
    // reference screenshot showing every empty choice's placeholder
    // visible simultaneously, not just whichever one has the cursor.
    //
    // Fixed by setting `showOnlyCurrent: false, includeChildren: true`
    // (makes the plugin decorate EVERY empty textblock in the document,
    // any depth, regardless of focus) and replicating the "only when
    // focused" gate MANUALLY inside the placeholder function itself for
    // the generic/non-question case (via the `hasAnchor` argument the
    // function already receives) — so ordinary body paragraphs keep
    // their original focus-only behavior while question/choice
    // paragraphs deliberately opt out of that gate.
    Placeholder.configure({
      showOnlyCurrent: false,
      includeChildren: true,
      placeholder: ({ editor, pos, hasAnchor }) => {
        const $pos = editor.state.doc.resolve(pos + 1);
        for (let depth = $pos.depth; depth > 0; depth -= 1) {
          const ancestor = $pos.node(depth);
          if (ancestor.type.name === "choiceItem") {
            // Same "resolve this choiceItem's own start position, then
            // read its index within its parent choiceList" pattern
            // choice-item-node-view.tsx uses for its (A)/(B)/... label
            // — kept in sync manually (small enough not to warrant a
            // shared constant/helper across files).
            const choiceItemStart = $pos.before(depth);
            const index = editor.state.doc.resolve(choiceItemStart).index();
            const label = CHOICE_LABELS[index] ?? String(index + 1);
            return choicePlaceholder(label);
          }
          if (ancestor.type.name === "questionItem") return questionBodyPlaceholder;
          if (ancestor.type.name === "tableHeader") return hasAnchor ? tableHeaderPlaceholder : "";
          if (ancestor.type.name === "tableCell") return hasAnchor ? tableCellPlaceholder : "";
        }
        return hasAnchor ? placeholder : "";
      },
    }),
    Typography,
    // TextStyle + Color back the per-block text color set from the block handle.
    TextStyle,
    Color,
    AnvilCodeBlock,
    AnvilCallout,
    AnvilProof,
    AnvilMermaid,
    AnvilFunctionPlot,
    AnvilStatsChart,
    AnvilQuestion,
    AnvilQuestionItem,
    AnvilChoiceList,
    AnvilChoiceItem,
    AnvilImageRow,
    AnvilImage.configure({
      HTMLAttributes: {
        "data-caption-label": figureLabel,
        "data-caption-placeholder": figureCaptionPlaceholder,
      },
    }),
    AnvilTable.configure({
      resizable: false,
      View: createAnvilTableView(
        tableLabel,
        tableCaptionPlaceholder,
        tableDeleteLabel,
        tableAddRowLabel,
        tableAddColumnLabel,
        tableResizeRowLabel,
        tableResizeColumnLabel,
      ),
    }),
    AnvilTableRow,
    AnvilTableHeader,
    AnvilTableCell,
    Mathematics.configure({
      katexOptions: { throwOnError: false },
      inlineOptions: {
        onClick: (node, pos) =>
          onMathClick("inline", pos, String(node.attrs.latex ?? "")),
      },
      blockOptions: {
        onClick: (node, pos) =>
          onMathClick(
            "block",
            pos,
            String(node.attrs.latex ?? ""),
            typeof node.attrs.refName === "string" ? node.attrs.refName : undefined,
          ),
      },
    }),
    BlockMathExit,
    MathArrowSelect.configure({ onMathClick }),
    CrossRefTargetIds,
    CrossRef,
    CrossRefSuggestion,
    QuestionBlank,
    QuestionBlankSuggestion,
    InlineBlank,
    TabNavigation.configure({ onMathClick }),
  ];
}
