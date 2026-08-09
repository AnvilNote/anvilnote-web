import { parseNumericInput, numericInputValue } from "@/lib/numeric-input";
import type { ChartRow, RowColumn } from "@/lib/chart/row-shapes";

// RFC4180-ish CSV parser — handles quoted fields (embedded commas/newlines,
// "" as an escaped quote) and both \r\n and \n line endings. No external
// dependency: the only CSV feature chart data needs is "a grid of cells",
// not dialect detection or streaming.
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  function endField() {
    row.push(field);
    field = "";
  }
  function endRow() {
    endField();
    rows.push(row);
    row = [];
  }

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      endField();
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      endRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  // Trailing field/row only if the file didn't end on a clean newline.
  if (field !== "" || row.length > 0) endRow();

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

// Target chart column key -> CSV column index (null = not mapped). A real
// spreadsheet export (insurance.csv: age,sex,bmi,children,smoker,region,
// charges) has zero reason to use OUR field names (x/y/group/...) — forcing
// an exact header match rejected every real-world file. Header-name
// matching is now only a best-effort GUESS the user reviews/corrects in
// ChartCsvMappingDialog, never a hard requirement.
export type ColumnMapping = Record<string, number | null>;

export function guessColumnMapping(header: string[], columns: RowColumn[]): ColumnMapping {
  const normalized = header.map((h) => h.trim().toLowerCase());
  const used = new Set<number>();
  const mapping: ColumnMapping = {};

  for (const col of columns) {
    const idx = normalized.indexOf(col.key.toLowerCase());
    if (idx !== -1 && !used.has(idx)) {
      mapping[col.key] = idx;
      used.add(idx);
    } else {
      mapping[col.key] = null;
    }
  }

  // Single-column shape (numberList): a plain list of numbers often has an
  // arbitrary or absent header ("value", "measurement", ...) — column 0 is
  // the only sane guess when the name itself didn't match.
  if (columns.length === 1 && mapping[columns[0].key] === null && header.length > 0) {
    mapping[columns[0].key] = 0;
  }

  return mapping;
}

export function isMappingComplete(mapping: ColumnMapping, columns: RowColumn[]): boolean {
  return columns.every((col) => {
    const idx = mapping[col.key];
    return idx !== null && idx !== undefined;
  });
}

// `csvRows` includes the header row at index 0 (mapping indices are CSV
// column positions, resolved once up front — the header row itself is
// never treated as data).
export function applyColumnMapping(csvRows: string[][], columns: RowColumn[], mapping: ColumnMapping): ChartRow[] {
  const dataLines = csvRows.slice(1).filter((line) => line.some((cell) => cell.trim() !== ""));

  return dataLines.map((line) => {
    const row: ChartRow = {};
    for (const col of columns) {
      const idx = mapping[col.key];
      const raw = idx != null ? (line[idx] ?? "").trim() : "";
      row[col.key] = col.type === "number" ? numericInputValue(parseNumericInput(raw)) : raw;
    }
    return row;
  });
}
