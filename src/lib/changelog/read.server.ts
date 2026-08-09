import { promises as fs } from "node:fs";
import path from "node:path";
import { parseChangelogMarkdown, type ChangelogEntry } from "./parse";
import type { AppLocale } from "@/lib/i18n/routing";

// Server-only (uses `fs`) -- read from the locale layout (a server
// component) and passed down to ChangelogHydrator, same pattern as
// StoreHydrator but sourced from a file instead of the client's own persisted
// state. `output: "standalone"` means this always runs against a real Node
// process (both plain web hosting and the desktop Electron sidecar), so a
// direct filesystem read here is safe in every environment this app ships to.
export async function readChangelog(locale: AppLocale): Promise<ChangelogEntry[]> {
  const filePath = path.join(process.cwd(), "src/content/changelog", `${locale}.md`);
  const raw = await fs.readFile(filePath, "utf8");
  return parseChangelogMarkdown(raw);
}
