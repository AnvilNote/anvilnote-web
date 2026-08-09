import { describe, expect, test } from "vitest";
import { encodeMathLabel, decodeMathLabel } from "./math-label";

describe("encodeMathLabel", () => {
  test("plain text with no $ passes through untouched", () => {
    expect(encodeMathLabel("Revenue")).toBe("Revenue");
  });

  test("pure math (whole string already one $...$ pair) is unchanged", () => {
    expect(encodeMathLabel("$\\alpha^2$")).toBe("$\\alpha^2$");
  });

  test("mixed plain-then-math wraps the plain part in \\text{}", () => {
    expect(encodeMathLabel("你好 $x$")).toBe("$\\text{你好 }x$");
  });

  test("mixed math-then-plain wraps the trailing plain part", () => {
    expect(encodeMathLabel("$x$ axis")).toBe("$x\\text{ axis}$");
  });

  test("plain, math, plain — multiple segments all combine into one block", () => {
    expect(encodeMathLabel("Speed $v$ over time")).toBe("$\\text{Speed }v\\text{ over time}$");
  });

  test("escapes backslashes and braces inside the \\text{} portion", () => {
    expect(encodeMathLabel("100% {done} $x$")).toBe("$\\text{100% \\{done\\} }x$");
  });
});

describe("decodeMathLabel", () => {
  test("plain text with no wrapping $ passes through untouched", () => {
    expect(decodeMathLabel("Revenue")).toBe("Revenue");
  });

  test("pure math (no \\text{} inside) round-trips as-is", () => {
    expect(decodeMathLabel("$\\alpha^2$")).toBe("$\\alpha^2$");
  });

  test("is the exact inverse of encodeMathLabel for mixed content", () => {
    const original = "Speed $v$ over time";
    expect(decodeMathLabel(encodeMathLabel(original))).toBe(original);
  });

  test("unescapes backslashes and braces inside \\text{}", () => {
    const original = "100% {done} $x$";
    expect(decodeMathLabel(encodeMathLabel(original))).toBe(original);
  });
});
