// A number <input>'s value prop is bound directly to a JS number, so
// clearing the field to "" and having onChange do Number("") -> 0 makes
// the field immediately redisplay "0" — backspace visually does nothing.
// NaN is used as the in-state sentinel for "currently empty" (still a
// valid `number`, so callers don't need to widen their state's field
// types to `number | ""`): parseNumericInput keeps an empty field as NaN
// instead of coercing it to 0, and numericInputValue renders NaN back out
// as "" so the input actually looks empty while the user is typing.
export function parseNumericInput(raw: string): number {
  return raw === "" ? NaN : Number(raw);
}

export function numericInputValue(value: number): number | string {
  return Number.isNaN(value) ? "" : value;
}
