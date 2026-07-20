import fs from "node:fs";
import path from "node:path";
import type { AppLocale } from "@/lib/i18n/routing";

// Legal page bodies live as plain markdown, not i18n JSON strings — this
// content is long-form prose reviewed independently of the app's UI copy,
// and editing a .md file is a much smaller diff than a JSON string edit.
const LEGAL_DATA_DIR = path.join(process.cwd(), "data", "legal");

export type LegalDoc = "privacy" | "terms";

export function readLegalDoc(doc: LegalDoc, locale: AppLocale): string {
  const localePath = path.join(LEGAL_DATA_DIR, doc, `${locale}.md`);
  if (fs.existsSync(localePath)) return fs.readFileSync(localePath, "utf-8");
  // English is the routing default locale and always has a file; every
  // other locale falls back to it if a translation hasn't landed yet.
  return fs.readFileSync(path.join(LEGAL_DATA_DIR, doc, "en.md"), "utf-8");
}
