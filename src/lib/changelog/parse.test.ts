import { describe, expect, test } from "vitest";
import { parseChangelogMarkdown } from "./parse";

describe("parseChangelogMarkdown", () => {
  test("parses version, date, and bullets for a single entry", () => {
    const raw = `## 0.1.21
2026-08-10
- **Watermarks**: add an image or text watermark
- Page size selection
`;
    const entries = parseChangelogMarkdown(raw);
    expect(entries).toEqual([
      {
        version: "0.1.21",
        date: "2026-08-10",
        bullets: ["**Watermarks**: add an image or text watermark", "Page size selection"],
      },
    ]);
  });

  test("parses multiple entries, newest first, in source order", () => {
    const raw = `## 0.2.0
2026-08-01
- Second thing

## 0.1.0
2026-07-01
- First thing
`;
    const entries = parseChangelogMarkdown(raw);
    expect(entries.map((e) => e.version)).toEqual(["0.2.0", "0.1.0"]);
    expect(entries[0].bullets).toEqual(["Second thing"]);
    expect(entries[1].bullets).toEqual(["First thing"]);
  });

  test("caps bullets at 5 per entry, dropping any beyond that", () => {
    const raw = [
      "## 1.0.0",
      "2026-01-01",
      "- one",
      "- two",
      "- three",
      "- four",
      "- five",
      "- six",
    ].join("\n");
    const entries = parseChangelogMarkdown(raw);
    expect(entries[0].bullets).toEqual(["one", "two", "three", "four", "five"]);
  });

  test("returns an empty array for content with no ## headers", () => {
    expect(parseChangelogMarkdown("just some text\n- a bullet\n")).toEqual([]);
  });

  test("an entry with no bullets still parses with an empty bullets array", () => {
    const raw = "## 0.0.1\n2026-01-01\n";
    expect(parseChangelogMarkdown(raw)).toEqual([
      { version: "0.0.1", date: "2026-01-01", bullets: [] },
    ]);
  });
});
