import HorizontalRule from "@tiptap/extension-horizontal-rule";

export type DividerLineStyle = "solid" | "dashed" | "dotted" | "dashdot";

const LINE_STYLES: DividerLineStyle[] = ["solid", "dashed", "dotted", "dashdot"];

// CSS has no native "dash-dot" border-style keyword (unlike Typst's
// stroke `dash:` or OOXML's border `w:val`, which both support it
// natively) — approximated as dashed for the web preview only; the PDF
// and DOCX exports render the real dash-dot pattern.
const CSS_BORDER_STYLE: Record<DividerLineStyle, string> = {
  solid: "solid",
  dashed: "dashed",
  dotted: "dotted",
  dashdot: "dashed",
};

function parseLineStyle(value: string | null): DividerLineStyle {
  return (LINE_STYLES as string[]).includes(value ?? "")
    ? (value as DividerLineStyle)
    : "solid";
}

// Extends Tiptap's own HorizontalRule (same name/content/commands/keyboard
// shortcuts/input rules — typing "---" still works) purely to add
// thickness/line-style attrs; StarterKit's own horizontalRule is disabled
// in extensions.ts so this is the one actually registered. Keeping the
// same node name ("horizontalRule") and HTML tag means existing saved
// documents (plain <hr>, no attrs) still parse fine — the new attrs
// simply default to the values used before this node existed (0.5pt
// solid, see build-entry.ts's prior hardcoded Typst literal).
export const AnvilDivider = HorizontalRule.extend({
  addAttributes() {
    return {
      thicknessPt: {
        default: 0.5,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-thickness-pt");
          const parsed = raw ? Number(raw) : NaN;
          return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.5;
        },
        renderHTML: (attributes) => ({
          "data-thickness-pt": String(attributes.thicknessPt),
        }),
      },
      lineStyle: {
        default: "solid",
        parseHTML: (element) => parseLineStyle(element.getAttribute("data-line-style")),
        renderHTML: (attributes) => ({ "data-line-style": attributes.lineStyle }),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const thickness = Number(HTMLAttributes["data-thickness-pt"]) || 0.5;
    const lineStyle = parseLineStyle(HTMLAttributes["data-line-style"] ?? null);
    return [
      "hr",
      {
        ...HTMLAttributes,
        // "pt" isn't a valid CSS length keyword browsers reliably
        // rasterize the same way Typst does, but it's close enough for an
        // editor preview and keeps the same unit as the thicknessPt attr
        // (no separate px conversion to keep in sync).
        style: `border-top-width: ${thickness}pt; border-top-style: ${CSS_BORDER_STYLE[lineStyle]};`,
      },
    ];
  },
});
