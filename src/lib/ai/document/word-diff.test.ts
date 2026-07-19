import { describe, expect, it } from "vitest";
import { createWordDiff } from "./word-diff";

describe("createWordDiff", () => {
  it("marks inserted and removed words without relying on color", () => {
    expect(createWordDiff("The quick fox", "The calm fox")).toEqual([
      { kind: "equal", text: "The " },
      { kind: "remove", text: "quick" },
      { kind: "add", text: "calm" },
      { kind: "equal", text: " fox" },
    ]);
  });
});
