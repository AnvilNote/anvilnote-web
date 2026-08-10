// Pure string parsing -- no `fs` here so this module is safe to import from
// both the server (read.server.ts) and the client (changelog-settings.tsx's
// bold-span renderer reuses nothing from this file directly, but keeping the
// type here avoids a server-only import leaking into a client component).
//
// Source format (src/content/changelog/<locale>.md), newest version first:
//   ## 0.1.21
//   2026-08-10
//   - **Watermarks**: add an image or text watermark to exported PDFs
//   - ...
// Authors are expected to keep each entry to at most 5 bullets and mark the
// important part of each one with **bold** -- this parser doesn't enforce
// the 5-bullet cap by truncating silently wrong content, it just never reads
// past the 5th one, so a 6th accidental bullet is dropped rather than shown.
export type ChangelogEntry = {
  version: string;
  date: string;
  bullets: string[];
};

const MAX_BULLETS_PER_ENTRY = 5;

export function parseChangelogMarkdown(raw: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;

  // A trailing \r (CRLF source, e.g. Windows CI checkout without a
  // .gitattributes eol=lf pin) makes every `$`-anchored regex below fail to
  // match at all -- `.` doesn't consume \r, so `$` never reaches the true
  // end of the line -- silently producing zero entries. Normalize up front
  // so parsing is line-ending-agnostic regardless of source.
  for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
    const versionMatch = /^##\s+(.+)$/.exec(line);
    if (versionMatch) {
      if (current) entries.push(current);
      current = { version: versionMatch[1].trim(), date: "", bullets: [] };
      continue;
    }
    if (!current) continue;

    const bulletMatch = /^-\s+(.+)$/.exec(line);
    if (bulletMatch) {
      if (current.bullets.length < MAX_BULLETS_PER_ENTRY) {
        current.bullets.push(bulletMatch[1].trim());
      }
      continue;
    }

    if (!current.date && line.trim()) {
      current.date = line.trim();
    }
  }
  if (current) entries.push(current);

  return entries;
}
