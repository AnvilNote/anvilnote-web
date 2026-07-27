import { describe, expect, test } from "vitest";
import {
  ORDERED_MODULE_IDS,
  UNORDERED_SYMBOLS,
  renderOrderedMarker,
} from "./marker-modules";

describe("marker modules", () => {
  test("exposes exactly 12 ordered modules and 12 unordered symbols", () => {
    expect(ORDERED_MODULE_IDS).toHaveLength(12);
    expect(UNORDERED_SYMBOLS).toHaveLength(12);
    expect(new Set(ORDERED_MODULE_IDS).size).toBe(12);
    expect(new Set(UNORDERED_SYMBOLS).size).toBe(12);
  });

  test("arabic and paren-arabic", () => {
    expect(renderOrderedMarker("arabic", 1)).toBe("1.");
    expect(renderOrderedMarker("arabic", 42)).toBe("42.");
    expect(renderOrderedMarker("paren-arabic", 1)).toBe("(1)");
  });

  test("circled falls back to arabic past the 20th item", () => {
    expect(renderOrderedMarker("circled", 1)).toBe("①");
    expect(renderOrderedMarker("circled", 20)).toBe("⑳");
    expect(renderOrderedMarker("circled", 21)).toBe("21.");
  });

  test("alpha wraps a-z then aa, ab, ...", () => {
    expect(renderOrderedMarker("alpha-lower", 1)).toBe("a.");
    expect(renderOrderedMarker("alpha-lower", 26)).toBe("z.");
    expect(renderOrderedMarker("alpha-lower", 27)).toBe("aa.");
    expect(renderOrderedMarker("alpha-upper", 1)).toBe("A.");
    expect(renderOrderedMarker("alpha-upper", 27)).toBe("AA.");
  });

  test("roman numerals", () => {
    expect(renderOrderedMarker("roman-lower", 1)).toBe("i.");
    expect(renderOrderedMarker("roman-lower", 4)).toBe("iv.");
    expect(renderOrderedMarker("roman-lower", 9)).toBe("ix.");
    expect(renderOrderedMarker("roman-lower", 14)).toBe("xiv.");
    expect(renderOrderedMarker("roman-lower", 40)).toBe("xl.");
    expect(renderOrderedMarker("roman-upper", 40)).toBe("XL.");
  });

  test("chinese numeral and japanese informal share the same digits", () => {
    expect(renderOrderedMarker("chinese-numeral", 1)).toBe("一、");
    expect(renderOrderedMarker("chinese-numeral", 10)).toBe("十、");
    expect(renderOrderedMarker("chinese-numeral", 11)).toBe("十一、");
    expect(renderOrderedMarker("chinese-numeral", 20)).toBe("二十、");
    expect(renderOrderedMarker("chinese-numeral", 21)).toBe("二十一、");
    expect(renderOrderedMarker("japanese-informal", 21)).toBe("二十一、");
  });

  test("japanese formal uses daiji for 1/2/3 and ten, plain digits for 4-9", () => {
    expect(renderOrderedMarker("japanese-formal", 1)).toBe("壱、");
    expect(renderOrderedMarker("japanese-formal", 2)).toBe("弐、");
    expect(renderOrderedMarker("japanese-formal", 3)).toBe("参、");
    expect(renderOrderedMarker("japanese-formal", 4)).toBe("四、");
    expect(renderOrderedMarker("japanese-formal", 10)).toBe("拾、");
    expect(renderOrderedMarker("japanese-formal", 21)).toBe("弐拾壱、");
  });

  test("korean hangul (sino-korean counting)", () => {
    expect(renderOrderedMarker("korean-hangul", 1)).toBe("일.");
    expect(renderOrderedMarker("korean-hangul", 10)).toBe("십.");
    expect(renderOrderedMarker("korean-hangul", 21)).toBe("이십일.");
  });

  test("thai consonants follow ก ข ค ง (skipping the obsolete letters)", () => {
    expect(renderOrderedMarker("thai-consonant", 1)).toBe("ก.");
    expect(renderOrderedMarker("thai-consonant", 2)).toBe("ข.");
    expect(renderOrderedMarker("thai-consonant", 3)).toBe("ค.");
    expect(renderOrderedMarker("thai-consonant", 4)).toBe("ฆ.");
    expect(renderOrderedMarker("thai-consonant", 5)).toBe("ง.");
  });

  test("thai consonant cycles after the 42nd letter", () => {
    expect(renderOrderedMarker("thai-consonant", 43)).toBe("ก.");
  });
});
