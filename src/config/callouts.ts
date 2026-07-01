export type CalloutKind = {
  id: string;
  accent: string;
  background: string;
};

// The 12 supported callout kinds, modeled on Obsidian's callout palette.
// Kind labels (and the default title text each kind seeds) live in i18n under
// editor.callout.kinds.<id> — not here, since they're user-facing strings.
// Keep this list in sync with anvilnote-renderer's src/config/callouts.ts and
// templates/shared/anvil-callout.typ (Typst render-side palette).
export const CALLOUT_KINDS: CalloutKind[] = [
  { id: "note", accent: "#448AFF", background: "#E5ECF8" },
  { id: "abstract", accent: "#00B0FF", background: "#DEF0F8" },
  { id: "info", accent: "#00B8D4", background: "#DEF1F4" },
  { id: "tip", accent: "#00BFA5", background: "#DEF1EF" },
  { id: "success", accent: "#01C853", background: "#DEF2E6" },
  { id: "question", accent: "#64DD17", background: "#E8F5E0" },
  { id: "warning", accent: "#FF9100", background: "#F8EDDE" },
  { id: "failure", accent: "#FF5252", background: "#F8E6E6" },
  { id: "danger", accent: "#FF1744", background: "#F8E0E5" },
  { id: "bug", accent: "#F50057", background: "#F7DEE7" },
  { id: "example", accent: "#7C4DFF", background: "#EBE6F8" },
  { id: "quote", accent: "#9E9E9E", background: "#EEEEEE" },
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
