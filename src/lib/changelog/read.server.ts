import { promises as fs } from "node:fs";
import path from "node:path";
import { parseChangelogMarkdown, type ChangelogEntry } from "./parse";
import type { AppLocale } from "@/lib/i18n/routing";

// Server-only (uses `fs`) -- read from the locale layout (a server
// component) and passed down to ChangelogHydrator, same pattern as
// StoreHydrator but sourced from a file instead of the client's own persisted
// state. `output: "standalone"` means this always runs against a real Node
// process (both plain web hosting and the desktop Electron sidecar), so a
// direct filesystem read here is safe in every environment this app ships to
// -- AS LONG AS the file is actually staged there. It's read via a plain fs
// path, not a static import, so Next's own output:"standalone" file tracer
// has no way to know about it and never copies it into .next/standalone on
// its own; the desktop packaging pipeline's copy-web.mjs stages it
// separately. Never let a missing/unreadable file take down the WHOLE
// locale layout (and therefore the entire app) over a changelog list --
// confirmed via a real packaged build that an unstaged file crashes with
// ENOENT here, and since this runs in the root layout, that crash previously
// took the whole app down instead of just leaving the changelog empty.
export async function readChangelog(locale: AppLocale): Promise<ChangelogEntry[]> {
  const filePath = path.join(process.cwd(), "src/content/changelog", `${locale}.md`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return parseChangelogMarkdown(raw);
  } catch (error) {
    console.error(`readChangelog: failed to read ${filePath}`, error);
    return [];
  }
}
