// Metadata date fields are always stored/wired as a plain "YYYY-MM-DD"
// string (see metadata-form.tsx's parseIsoDate/toIsoDate comments for why) —
// this module only controls how that stored value is DISPLAYED, both in the
// metadata panel's picker button and in the value actually sent to the
// renderer/exported PDF. Changing the format never touches the stored ISO
// string itself, so switching formats back and forth is always lossless.
export const DATE_FORMATS = [
  "yyyy/mm/dd",
  "mm/dd/yyyy",
  "dd/mm/yyyy",
  "yyyy-mm-dd",
  "mm-dd-yyyy",
  "dd-mm-yyyy",
] as const;

export type DateFormat = (typeof DATE_FORMATS)[number];

export const DEFAULT_DATE_FORMAT: DateFormat = "yyyy/mm/dd";

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Resolves a template's "today" sentinel (a date field's own manifest
 *  default — see minimal-lecture/manifest.json et al.) to today's actual
 *  ISO date; any other value passes through unchanged. Must run before
 *  formatIsoDate, which only recognizes real "YYYY-MM-DD" strings and
 *  would otherwise print the literal word "today" verbatim into a PDF
 *  exported before the user ever opened the date picker to replace it
 *  with a real date. */
export function resolveIsoDate(value: string): string {
  return value === "today" ? new Date().toISOString().slice(0, 10) : value;
}

/** Formats a stored "YYYY-MM-DD" string per the chosen DateFormat. Returns
 *  the input unchanged if it isn't a well-formed ISO date (e.g. an older
 *  document saved before this field existed) — callers that might be
 *  holding the "today" sentinel should resolveIsoDate() first. */
export function formatIsoDate(iso: string, dateFormat: DateFormat): string {
  const match = ISO_PATTERN.exec(iso);
  if (!match) return iso;
  const [, yyyy, mm, dd] = match;
  switch (dateFormat) {
    case "yyyy/mm/dd":
      return `${yyyy}/${mm}/${dd}`;
    case "mm/dd/yyyy":
      return `${mm}/${dd}/${yyyy}`;
    case "dd/mm/yyyy":
      return `${dd}/${mm}/${yyyy}`;
    case "yyyy-mm-dd":
      return `${yyyy}-${mm}-${dd}`;
    case "mm-dd-yyyy":
      return `${mm}-${dd}-${yyyy}`;
    case "dd-mm-yyyy":
      return `${dd}-${mm}-${yyyy}`;
  }
}
