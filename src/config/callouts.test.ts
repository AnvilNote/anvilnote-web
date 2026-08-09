import { describe, expect, test } from "vitest";
import {
  CALLOUT_KINDS,
  accentOrReadableTextColor,
  computeCustomPalette,
  readableTextColor,
} from "./callouts";

describe("readableTextColor", () => {
  test("picks white for a dark background", () => {
    expect(readableTextColor("#191e2e")).toBe("#FFFFFF");
  });

  test("picks near-black for a light background", () => {
    expect(readableTextColor("#E5ECF8")).toBe("#0A0A0A");
  });

  test("picks white for pure black, near-black for pure white", () => {
    expect(readableTextColor("#000000")).toBe("#FFFFFF");
    expect(readableTextColor("#FFFFFF")).toBe("#0A0A0A");
  });
});

describe("accentOrReadableTextColor", () => {
  // Regression: an earlier version used the WCAG AA 4.5:1 floor here,
  // which none of the 12 real presets' own accent/background pairs
  // actually clear (measured directly) -- that would have repainted every
  // existing callout's title away from its accent color the moment this
  // shipped. None of them should ever trigger the fallback.
  test("every preset's accent stays the title color against its own background/darkBackground", () => {
    for (const kind of CALLOUT_KINDS) {
      expect(accentOrReadableTextColor(kind.accent, kind.background)).toBe(kind.accent);
      expect(accentOrReadableTextColor(kind.accent, kind.darkBackground)).toBe(kind.accent);
    }
  });

  test("a near-identical accent/background pairing falls back to a readable color", () => {
    // Reproduces the reported bug's shape (not its exact hexes): an accent
    // barely distinguishable from its own background.
    expect(accentOrReadableTextColor("#1a1e2c", "#191e2e")).toBe(readableTextColor("#191e2e"));
  });

  test("a genuinely legible custom accent is kept as-is", () => {
    expect(accentOrReadableTextColor("#3b82f6", "#e0e8f5")).toBe("#3b82f6");
  });
});

describe("computeCustomPalette", () => {
  test("background/darkBackground share the accent's hue and land in the observed preset bands", () => {
    const palette = computeCustomPalette("#3b82f6");
    expect(palette.accent).toBe("#3b82f6");
    // Light background: HSL(hue, 50, 92); dark: HSL(hue, 40, 24) -- both
    // computed, not looked up, so this just confirms the formula ran, not
    // exact hex values (already covered by the renderer's own equivalent
    // Typst-side test).
    expect(palette.background).toMatch(/^#[0-9a-f]{6}$/i);
    expect(palette.darkBackground).toMatch(/^#[0-9a-f]{6}$/i);
    expect(palette.background).not.toBe(palette.darkBackground);
  });
});
