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
