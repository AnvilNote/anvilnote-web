export type CalloutKind = {
  id: string;
  accent: string;
  background: string;
  darkBackground: string;
};

// The 12 supported callout kinds, modeled on Obsidian's callout palette.
// Kind labels (and the default title text each kind seeds) live in i18n under
// editor.callout.kinds.<id> — not here, since they're user-facing strings.
// Keep this list in sync with anvilnote-renderer's src/config/callouts.ts and
// templates/shared/anvil-callout.typ (Typst render-side palette).
//
// Both `background` and `darkBackground` are fixed hex values, not computed
// at runtime via CSS color-mix() from `accent` — an earlier version derived
// the background that way (mixing accent into the theme's own --background
// in OKLCH), which measured correctly in a regular browser but rendered as
// a uniformly wrong yellow-green/olive tint for every single kind inside
// the packaged Electron desktop app, regardless of the kind's actual accent
// hue. That's consistent with the app's bundled Chromium disagreeing with
// a regular browser on interpolating hue through color-mix(in oklch, ...)
// (an achromatic --background endpoint has a "powerless" hue, and engines
// have been inconsistent about how that resolves) — a real, observed
// cross-engine gap, not a CSS logic bug. Precomputed hex removes the
// runtime color math (and that platform risk) entirely: darkBackground
// values are `accent` blended 22% over an oklch(0.16 0 0)-equivalent dark
// gray, matching the ratio the old dark-mode color-mix call used.
export const CALLOUT_KINDS: CalloutKind[] = [
  { id: "note", accent: "#448AFF", background: "#E5ECF8", darkBackground: "#2F3E58" },
  { id: "abstract", accent: "#00B0FF", background: "#DEF0F8", darkBackground: "#204758" },
  { id: "info", accent: "#00B8D4", background: "#DEF1F4", darkBackground: "#20484F" },
  { id: "tip", accent: "#00BFA5", background: "#DEF1EF", darkBackground: "#204A44" },
  { id: "success", accent: "#01C853", background: "#DEF2E6", darkBackground: "#204C32" },
  { id: "question", accent: "#64DD17", background: "#E8F5E0", darkBackground: "#365125" },
  { id: "warning", accent: "#FF9100", background: "#F8EDDE", darkBackground: "#584020" },
  { id: "failure", accent: "#FF5252", background: "#F8E6E6", darkBackground: "#583232" },
  { id: "danger", accent: "#FF1744", background: "#F8E0E5", darkBackground: "#58252F" },
  { id: "bug", accent: "#F50057", background: "#F7DEE7", darkBackground: "#562033" },
  { id: "example", accent: "#7C4DFF", background: "#EBE6F8", darkBackground: "#3B3158" },
  { id: "quote", accent: "#9E9E9E", background: "#EEEEEE", darkBackground: "#434343" },
];

export const DEFAULT_CALLOUT_KIND = "note";

const CALLOUT_KIND_IDS = new Set(CALLOUT_KINDS.map((k) => k.id));

export function normalizeCalloutKind(value: string | undefined | null): string {
  if (value && CALLOUT_KIND_IDS.has(value)) return value;
  return DEFAULT_CALLOUT_KIND;
}

export function calloutPalette(kind: string): CalloutKind {
  return (
    CALLOUT_KINDS.find((k) => k.id === normalizeCalloutKind(kind)) ??
    CALLOUT_KINDS[0]
  );
}
