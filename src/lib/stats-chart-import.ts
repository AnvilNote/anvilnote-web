import * as XLSX from "xlsx";
import { MAX_ENTRIES, MAX_SERIES, SCATTER_MAX_ENTRIES, defaultEntryColor } from "@/lib/stats-chart-defaults";
import type { BoxWhiskerEntry, CategoricalEntry, ScatterEntry, StackedEntry } from "@/lib/tiptap/stats-chart";

// SheetJS (xlsx package) reads .csv/.xls/.xlsx/.ods all through the same
// XLSX.read() entry point — it sniffs the format from the file content,
// not the extension, so one code path covers every format this dialog's
// file picker accepts.
export const SPREADSHEET_IMPORT_ACCEPT = ".csv,.xls,.xlsx,.ods";

function readSheetRows(buffer: ArrayBuffer): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  // header: 1 asks for an array of arrays (raw cell values per row) instead
  // of objects keyed by an assumed header row — this dialog decides for
  // itself whether row 0 looks like a header (see isHeaderRow below), since
  // a plain data export may or may not have one.
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
}

function toNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toLabel(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

// Heuristic: a header row's non-label cells are column NAMES ("Value",
// "Min"), which don't parse as numbers — a data row's do. Only checks the
// second cell (first numeric column in both shapes), since that's enough
// to distinguish "Label, Value" from "Mon, 10".
function isHeaderRow(row: unknown[]): boolean {
  if (row.length < 2) return false;
  const second = row[1];
  return second !== undefined && second !== null && second !== "" && !Number.isFinite(Number(second));
}

export async function parseCategoricalSpreadsheet(file: File): Promise<CategoricalEntry[]> {
  const buffer = await file.arrayBuffer();
  const rows = readSheetRows(buffer);
  const dataRows = rows.length > 0 && isHeaderRow(rows[0]) ? rows.slice(1) : rows;
  return dataRows.slice(0, MAX_ENTRIES).map((row, index) => ({
    label: toLabel(row[0]),
    value: toNumber(row[1]),
    color: defaultEntryColor(index),
  }));
}

// Scatter's own two-column (x, y) shape — both numeric, unlike
// categorical's (label, value). isHeaderRow's own heuristic (second cell
// doesn't parse as a number) still correctly detects a "x,y" header row
// here: the header text "y" is itself non-numeric, same as "Value"/"Min"
// would be for the other shapes.
export async function parseScatterSpreadsheet(file: File): Promise<ScatterEntry[]> {
  const buffer = await file.arrayBuffer();
  const rows = readSheetRows(buffer);
  const dataRows = rows.length > 0 && isHeaderRow(rows[0]) ? rows.slice(1) : rows;
  return dataRows.slice(0, SCATTER_MAX_ENTRIES).map((row) => ({
    x: toNumber(row[0]),
    y: toNumber(row[1]),
  }));
}

export async function parseBoxWhiskerSpreadsheet(file: File): Promise<BoxWhiskerEntry[]> {
  const buffer = await file.arrayBuffer();
  const rows = readSheetRows(buffer);
  const dataRows = rows.length > 0 && isHeaderRow(rows[0]) ? rows.slice(1) : rows;
  return dataRows.slice(0, MAX_ENTRIES).map((row) => ({
    label: toLabel(row[0]),
    min: toNumber(row[1]),
    q1: toNumber(row[2]),
    median: toNumber(row[3]),
    q3: toNumber(row[4]),
    max: toNumber(row[5]),
  }));
}

export async function parseStackedSpreadsheet(
  file: File,
): Promise<{ data: StackedEntry[]; seriesLabels: string[] }> {
  const buffer = await file.arrayBuffer();
  const rows = readSheetRows(buffer);
  const hasHeader = rows.length > 0 && isHeaderRow(rows[0]);
  const headerRow = hasHeader ? rows[0] : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const seriesCount = Math.max(
    1,
    Math.min(
      MAX_SERIES,
      Math.max(...dataRows.map((row) => Math.max(0, row.length - 1)), headerRow.length - 1),
    ),
  );
  const seriesLabels = Array.from({ length: seriesCount }, (_, index) => {
    const header = toLabel(headerRow[index + 1]);
    return header || `Series ${index + 1}`;
  });
  const data = dataRows.slice(0, MAX_ENTRIES).map((row) => ({
    label: toLabel(row[0]),
    values: Array.from({ length: seriesCount }, (_, index) => toNumber(row[index + 1])),
  }));
  return { data, seriesLabels };
}
