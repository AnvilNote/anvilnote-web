// Sanity checks for the actual authored content in src/content/changelog/ --
// catches formatting slips (a missing blank line, a stray bullet marker)
// across 6 hand-written locale files without needing to eyeball every one.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { locales } from "@/lib/i18n/routing";
import { parseChangelogMarkdown } from "./parse";

const CONTENT_DIR = path.join(process.cwd(), "src/content/changelog");

function readLocale(locale: string) {
  return parseChangelogMarkdown(readFileSync(path.join(CONTENT_DIR, `${locale}.md`), "utf8"));
}

describe("changelog content", () => {
  test("every locale file parses to the same set of versions, newest first", () => {
    const byLocale = Object.fromEntries(locales.map((l) => [l, readLocale(l)]));
    const versions = byLocale[locales[0]].map((e) => e.version);
    expect(versions.length).toBeGreaterThan(0);
    // Newest-first ordering: version strings sort correctly as dotted numeric triples.
    const sorted = [...versions].sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true }),
    );
    expect(versions).toEqual(sorted);

    for (const locale of locales) {
      expect(byLocale[locale].map((e) => e.version)).toEqual(versions);
    }
  });

  test("every entry has a date and at least one non-empty bullet, in every locale", () => {
    for (const locale of locales) {
      for (const entry of readLocale(locale)) {
        expect(entry.date, `${locale} ${entry.version} date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry.bullets.length, `${locale} ${entry.version} bullets`).toBeGreaterThan(0);
        expect(entry.bullets.length, `${locale} ${entry.version} bullets`).toBeLessThanOrEqual(5);
        for (const bullet of entry.bullets) {
          expect(bullet.trim().length, `${locale} ${entry.version} bullet text`).toBeGreaterThan(0);
        }
      }
    }
  });

  test("every ** bold marker is properly closed", () => {
    for (const locale of locales) {
      for (const entry of readLocale(locale)) {
        for (const bullet of entry.bullets) {
          const markerCount = (bullet.match(/\*\*/g) ?? []).length;
          expect(markerCount % 2, `${locale} ${entry.version}: "${bullet}"`).toBe(0);
        }
      }
    }
  });
});
