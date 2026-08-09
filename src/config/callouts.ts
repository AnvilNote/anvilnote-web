import Color from "color";

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

// A 13th, deliberately-not-in-CALLOUT_KINDS option: unlike the 12 presets
// above (fixed accent+background+darkBackground hex triples), "custom" has
// no fixed palette of its own — its accent comes from the user's own color
// picker (callout.ts's customAccent attr) and its background/darkBackground
// are computed from that accent (see computeCustomPalette below), not
// looked up.
export const CUSTOM_CALLOUT_KIND = "custom";

const CALLOUT_KIND_IDS = new Set(CALLOUT_KINDS.map((k) => k.id));

export function normalizeCalloutKind(value: string | undefined | null): string {
  if (value === CUSTOM_CALLOUT_KIND) return value;
  if (value && CALLOUT_KIND_IDS.has(value)) return value;
  return DEFAULT_CALLOUT_KIND;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Derives a background/darkBackground for an arbitrary user-picked accent,
// approximating (not reproducing exactly — see this repo's own investigation
// into the 12 presets above, which turned out to be hand-tuned per hue, not
// output of one strict formula) the same "very light tint of the accent /
// darker muted tint of the accent" relationship those presets already have:
// same hue as the accent, fixed saturation/lightness for each mode. Values
// (light: S 50% L 92%, dark: S 40% L 24%) were picked to land inside the
// existing presets' own observed bands (light L 90.8-93.7%, dark L
// 20.8-27.1%) rather than matching any one kind exactly.
export function computeCustomPalette(accentHex: string): CalloutKind {
  const hue = Color(accentHex).hue();
  return {
    id: CUSTOM_CALLOUT_KIND,
    accent: accentHex,
    background: Color.hsl(hue, 50, 92).hex(),
    darkBackground: Color.hsl(hue, 40, 24).hex(),
  };
}

// customAccent only matters (and only needs to be a valid hex) when kind is
// "custom" -- for any of the 12 fixed presets it's ignored entirely, same as
// how customBackground layers independently on top of either case.
export function calloutPalette(kind: string, customAccent?: string | null): CalloutKind {
  const normalized = normalizeCalloutKind(kind);
  if (normalized === CUSTOM_CALLOUT_KIND) {
    return computeCustomPalette(
      customAccent && HEX_COLOR.test(customAccent) ? customAccent : CALLOUT_KINDS[0].accent,
    );
  }
  return CALLOUT_KINDS.find((k) => k.id === normalized) ?? CALLOUT_KINDS[0];
}

// WCAG relative luminance (the standard formula behind contrast-ratio math,
// not just a plain average of the RGB channels — it weights green highest
// and applies a gamma-correction curve first, matching how the eye actually
// perceives brightness).
function relativeLuminance(hex: string): number {
  const gammaCorrect = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) =>
    gammaCorrect(parseInt(hex.slice(i, i + 2), 16) / 255),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG contrast ratio: (lighter + 0.05) / (darker + 0.05), ranges 1
// (identical) to 21 (pure black vs. pure white).
function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

// The 12 presets' own background/darkBackground pairs were hand-tuned
// alongside a fixed default text color that already reads fine against
// both (see this file's own header comment on how those were picked) — this
// only matters for computeCustomPalette's OWN output, where the accent (and
// therefore the derived background) can be literally anything the user
// picks, including combinations where a fixed default text color doesn't
// have enough contrast to read at all (the bug this was written for: a dark
// custom accent's own computed dark-mode background landed close enough to
// the accent's own luminance that the callout's title/body text became
// nearly invisible against it). Whichever of pure white or near-black has
// the higher WCAG contrast ratio against the given background wins — not a
// single fixed luminance threshold, so it stays correct at both ends
// (a background near pure white AND one near pure black both resolve
// unambiguously) rather than needing a separately-justified cutoff value.
export function readableTextColor(backgroundHex: string): string {
  const bgLuminance = relativeLuminance(backgroundHex);
  return contrastRatio(bgLuminance, 1) >= contrastRatio(bgLuminance, 0) ? "#FFFFFF" : "#0A0A0A";
}

// Below this, a background reads as "dark" and body text needs an explicit
// light color; at or above it, the existing default (the app's own themed
// --foreground, inherited — never overridden here) already reads fine and
// should be left alone. Not derived from readableTextColor's own
// black/white split point (0.179) -- that value picks the BETTER of two
// fixed endpoints for a color already known to need an explicit override,
// a different question from "does this one need overriding at all". 0.4
// instead sits in the middle of a real, wide, empirically-measured gap: all
// 12 presets' own light backgrounds measured 0.778-0.878, every one of
// their dark backgrounds measured 0.033-0.068 (see this file's own header
// comment for those hex values) -- anywhere in that gap works, 0.4 is just
// the simplest round number inside it. Exists specifically so a normal
// light callout background doesn't get its body text force-set to a
// hardcoded near-black that's a shade off from the theme's ACTUAL default
// foreground color (oklch(0.18 0 0), not exactly #0A0A0A) -- a real,
// visible-on-close-inspection mismatch this sidesteps by simply not
// touching color at all for the common case.
const DARK_BACKGROUND_LUMINANCE_THRESHOLD = 0.4;

export function isBackgroundDark(backgroundHex: string): boolean {
  return relativeLuminance(backgroundHex) < DARK_BACKGROUND_LUMINANCE_THRESHOLD;
}

// NOT WCAG AA's 4.5:1 — measured all 12 presets' own accent-vs-background
// contrast directly (title text is bold accent-on-pastel, not body text)
// and the real range is roughly 1.5-5.0, worst case "question" at 1.56 in
// light mode. These were hand-picked to look right, not to clear a formal
// accessibility bar, so a 4.5 floor here would silently repaint every
// existing preset's title away from its accent color the moment this
// shipped — a real regression this function is supposed to prevent, not
// cause.
//
// Deliberately low (not "just under 1.56"): a threshold placed right below
// the lowest accepted preset would sit right on top of ordinary "a bit low
// but still legible" custom pairings too — measured directly against a real
// reported case (an accidental customBackground drag landed on #191e2e
// against a dark gray accent) and that pairing's own contrast was 1.74,
// HIGHER than "question"'s own accepted 1.56. No single cutoff separates
// "accepted existing design" from "the reported bug" when the two overlap
// like that — so this only catches genuinely pathological near-identical
// pairings (contrast approaching 1.0, i.e. barely distinguishable colors),
// not merely mediocre ones. Body text's own readableTextColor call (always
// applied, no threshold) is the fix that actually matters for legibility;
// this one is a narrower safety net specifically for the accent-colored
// title, tuned to never touch any of the 12 presets.
const MIN_ACCEPTABLE_CONTRAST = 1.2;

// Callout titles are colored with the kind's accent by design (the visual
// element that makes a callout read as "warning" vs. "tip" at a glance,
// not just its background tint) — this keeps that for every case where the
// accent has at least SOME real contrast against its own background
// (every one of the 12 presets does, comfortably above the floor above),
// and only falls back to readableTextColor's plain white/near-black for a
// pairing bad enough that the title text would otherwise be genuinely
// unreadable — reachable only via a user-picked custom accent.
export function accentOrReadableTextColor(accentHex: string, backgroundHex: string): string {
  const contrast = contrastRatio(relativeLuminance(accentHex), relativeLuminance(backgroundHex));
  return contrast >= MIN_ACCEPTABLE_CONTRAST ? accentHex : readableTextColor(backgroundHex);
}
