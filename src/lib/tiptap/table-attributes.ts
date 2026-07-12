const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;
const LENGTH = /^(?:0|\d+(?:\.\d+)?)(?:pt|px|em|rem)$/;

export function normalizeCellColor(value: unknown): string | null {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : null;
}

export function normalizeCellInset(value: unknown): string | null {
  return typeof value === "string" && LENGTH.test(value) ? value : null;
}

export function normalizeCellBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function normalizeCellVerticalAlign(
  value: unknown,
): "top" | "middle" | "bottom" | null {
  return value === "top" || value === "middle" || value === "bottom"
    ? value
    : null;
}

// Black-or-white text for a given fill, decided mathematically instead of
// by eye: WCAG relative luminance — linearize each sRGB channel
// (c/12.92 below 0.03928, ((c+0.055)/1.055)^2.4 above) and weight with
// Rec.709 coefficients L = 0.2126R + 0.7152G + 0.0722B — compared against
// L = 0.179, the exact point where the contrast ratio against black,
// (L + 0.05) / 0.05, equals the ratio against white, 1.05 / (L + 0.05).
// Above it black text reads better, below it white does. Kept in sync
// manually with anvilnote-renderer's copy (same no-shared-package
// convention as question-choices).
export function contrastTextColor(fill: string): "#000000" | "#ffffff" {
  const hex = fill.replace(/^#/, "");
  const short = hex.length === 3 || hex.length === 4;
  const channel = (index: number) => {
    const raw = short ? hex[index] + hex[index] : hex.slice(index * 2, index * 2 + 2);
    const value = parseInt(raw, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
