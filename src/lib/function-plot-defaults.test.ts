import { describe, expect, test } from "vitest";
import {
  DEFAULT_GRID_STEP,
  MAX_CURVES_BY_MODE,
  defaultCurve,
} from "./function-plot-defaults";

describe("function plot defaults", () => {
  test("uses mode-specific curve limits", () => {
    expect(MAX_CURVES_BY_MODE["1d"]).toBe(5);
    expect(MAX_CURVES_BY_MODE["2d"]).toBe(5);
    expect(MAX_CURVES_BY_MODE["3d-surface"]).toBe(1);
    expect(MAX_CURVES_BY_MODE["3d-contour"]).toBe(1);
  });

  test("creates a funcs-compatible curve", () => {
    expect(defaultCurve()).toEqual({
      expr: "",
      color: "#000000",
      label: "f",
      labelOffsetX: 0,
      labelOffsetY: 0,
    });
    expect(DEFAULT_GRID_STEP).toBe(1);
  });

  test("cycles default labels by index", () => {
    expect(defaultCurve(1).label).toBe("g");
    expect(defaultCurve(4).label).toBe("j");
  });
});
