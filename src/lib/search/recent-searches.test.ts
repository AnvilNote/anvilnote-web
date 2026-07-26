import { describe, expect, it } from "vitest";
import { addRecentSearch } from "./recent-searches";

describe("addRecentSearch", () => {
  it("keeps five newest non-empty searches and de-duplicates them", () => {
    let searches: string[] = [];
    for (const query of ["粗體", "分頁", "版本", "備份", "公式", "範本"]) {
      searches = addRecentSearch(searches, query);
    }

    expect(searches).toEqual(["範本", "公式", "備份", "版本", "分頁"]);
    expect(addRecentSearch(searches, "  備份  ")).toEqual([
      "備份",
      "範本",
      "公式",
      "版本",
      "分頁",
    ]);
    expect(addRecentSearch(searches, "   ")).toEqual(searches);
  });

  it("treats Unicode and casing equivalents as the same search", () => {
    expect(addRecentSearch(["PDF", "分頁"], "ｐｄｆ")).toEqual([
      "ｐｄｆ",
      "分頁",
    ]);
  });
});
