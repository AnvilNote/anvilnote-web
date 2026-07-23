import { describe, expect, it } from "vitest";
import { colorFromCustomPalette } from "./palettes";

describe("colorFromCustomPalette", () => {
  it("returns the color at the given index", () => {
    expect(colorFromCustomPalette(["#111111", "#222222", "#333333"], 1)).toBe("#222222");
  });

  it("cycles back to the start once the index exceeds the palette length", () => {
    expect(colorFromCustomPalette(["#111111", "#222222", "#333333"], 3)).toBe("#111111");
    expect(colorFromCustomPalette(["#111111", "#222222", "#333333"], 4)).toBe("#222222");
  });

  it("falls back to black for an empty palette", () => {
    expect(colorFromCustomPalette([], 0)).toBe("#000000");
  });
});
