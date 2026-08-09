"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/color-picker";
import {
  CALLOUT_KINDS,
  CUSTOM_CALLOUT_KIND,
  accentOrReadableTextColor,
  calloutPalette,
  isBackgroundDark,
  normalizeCalloutKind,
  readableTextColor,
} from "@/config/callouts";

function rgbaToHex(rgba: number[]): string {
  const [r, g, b] = rgba as [number, number, number, number];
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

type OpenPopover = "accent" | "background" | null;

// React NodeView for callouts: a colored box (accent left border + tinted
// background from the kind's palette), an editable title, the paragraph body
// (NodeViewContent), a borderless kind switcher, and a delete button, both
// pinned to the bottom-right corner. Switching kind only re-seeds the title
// while the user hasn't typed their own (titleTouched stays false until
// they edit it).
//
// The delete button exists because callout sets `isolating: true` (blocks
// merging content across its boundary — needed so pressing Enter at the end
// of the last paragraph doesn't accidentally splice the next block's
// content into the callout). That same isolation means the normal
// "Backspace at the start of the block right after this one" gesture,
// which deletes/merges most other block types, does nothing here by
// design — a callout was never deletable that way, only via an explicit
// affordance. A plain onClick button (not layered on the shared drag
// handle) has none of the pointerdown-vs-drag-gesture conflict that a
// dropdown trigger there ran into (see block-handle.tsx's history).
export function CalloutNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useTranslations("editor.callout");
  const tBlock = useTranslations("editor.block");
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null);
  const kind = normalizeCalloutKind(node.attrs.kind as string | undefined);
  const isCustomKind = kind === CUSTOM_CALLOUT_KIND;
  const title = typeof node.attrs.title === "string" ? node.attrs.title : "";
  const titleTouched = Boolean(node.attrs.titleTouched);
  const customBackground = typeof node.attrs.customBackground === "string" ? node.attrs.customBackground : null;
  const customAccent = typeof node.attrs.customAccent === "string" ? node.attrs.customAccent : null;
  const palette = calloutPalette(kind, customAccent);
  const backgroundLight = customBackground || palette.background;
  const backgroundDark = customBackground || palette.darkBackground;
  // For all 12 fixed presets these are just palette.accent and a plain
  // default text color, unchanged from before this existed -- only a
  // pathologically low-contrast custom accent/background pairing (only
  // reachable via the custom kind's own free-form color pickers) ever makes
  // these diverge from that. See callouts.ts's own comments on why this
  // needs a light AND dark variant of each rather than one computed value:
  // customBackground (independent of kind) applies identically to both
  // modes, so a background that's genuinely dark can show up while the
  // PAGE itself is in light theme, same as the reported bug that prompted
  // this — text color has to be computed from the callout's own active
  // background, not from the page's theme.
  const titleColorLight = accentOrReadableTextColor(palette.accent, backgroundLight);
  const titleColorDark = accentOrReadableTextColor(palette.accent, backgroundDark);
  // undefined (not readableTextColor's own near-black) for an ordinary
  // light background -- the app's real themed --foreground is already a
  // shade off from readableTextColor's hardcoded #0A0A0A, so leaving this
  // undefined here (letting CSS fall through to that inherited color
  // instead of the globals.css rule below setting an explicit one) avoids a
  // visible-on-close-inspection mismatch for every one of the 12 presets'
  // own light-mode appearance, none of which needed touching.
  const contentColorLight = isBackgroundDark(backgroundLight)
    ? readableTextColor(backgroundLight)
    : undefined;
  const contentColorDark = isBackgroundDark(backgroundDark)
    ? readableTextColor(backgroundDark)
    : undefined;

  function setKind(nextKind: string) {
    const normalized = normalizeCalloutKind(nextKind);
    updateAttributes({
      kind: normalized,
      ...(titleTouched ? {} : { title: t(`kinds.${normalized}` as never) }),
    });
  }

  function setTitle(value: string) {
    updateAttributes({ title: value, titleTouched: true });
  }

  function setCustomBackground(hex: string | null) {
    updateAttributes({ customBackground: hex });
  }

  function setCustomAccent(hex: string) {
    updateAttributes({ customAccent: hex });
  }

  return (
    <NodeViewWrapper
      className="anvil-callout"
      data-kind={kind}
      // Both background variants are fixed hex from the palette (see
      // callouts.ts's comment on why — a runtime color-mix() formula here
      // measured correctly in a regular browser but rendered visibly wrong,
      // uniformly yellow-green, inside the packaged Electron app). The CSS
      // .dark selector below picks between them — this component doesn't
      // need to know the current theme itself.
      style={
        {
          "--callout-bg-light": backgroundLight,
          "--callout-bg-dark": backgroundDark,
          "--callout-title-light": titleColorLight,
          "--callout-title-dark": titleColorDark,
          ...(contentColorLight ? { "--callout-content-light": contentColorLight } : {}),
          ...(contentColorDark ? { "--callout-content-dark": contentColorDark } : {}),
          borderLeftColor: palette.accent,
        } as CSSProperties
      }
    >
      <input
        type="text"
        value={title}
        placeholder={t(`kinds.${kind}` as never)}
        onChange={(event) => setTitle(event.target.value)}
        onMouseDown={(event) => event.stopPropagation()}
        className="anvil-callout__title"
      />

      <NodeViewContent className="anvil-callout__content" />

      <div className="anvil-callout__kind-picker" contentEditable={false}>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger
            size="sm"
            aria-label={t("selectKind")}
            onMouseDown={(event) => event.stopPropagation()}
            className="h-6 gap-1 border-0 bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 data-[state=open]:text-foreground"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" className="max-h-72">
            {CALLOUT_KINDS.map((entry) => (
              <SelectItem key={entry.id} value={entry.id} className="text-xs">
                {t(`kinds.${entry.id}` as never)}
              </SelectItem>
            ))}
            {/* Last item, deliberately outside CALLOUT_KINDS -- see
                CUSTOM_CALLOUT_KIND's own comment in config/callouts.ts for
                why it isn't just a 13th preset entry. */}
            <SelectItem value={CUSTOM_CALLOUT_KIND} className="text-xs">
              {t("kinds.custom")}
            </SelectItem>
          </SelectContent>
        </Select>
        {isCustomKind ? (
          <Popover
            onOpenChange={(open) => setOpenPopover(open ? "accent" : null)}
            open={openPopover === "accent"}
          >
            <PopoverTrigger asChild>
              <button
                aria-label={t("customAccent")}
                className="flex size-6 items-center justify-center rounded"
                onMouseDown={(event) => event.stopPropagation()}
                title={t("customAccent")}
                type="button"
              >
                <span
                  className="size-3.5 rounded-full border-2 border-muted-foreground/40"
                  style={{ backgroundColor: palette.accent }}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 rounded-2xl" onMouseDown={(event) => event.stopPropagation()}>
              <ColorPicker
                className="gap-3"
                onChange={(rgba) => setCustomAccent(rgbaToHex(rgba as number[]))}
                value={palette.accent}
              >
                <ColorPickerSelection className="h-32" />
                <ColorPickerHue />
                <div className="flex items-center gap-2">
                  <ColorPickerEyeDropper />
                  <ColorPickerOutput />
                </div>
                <ColorPickerFormat />
              </ColorPicker>
            </PopoverContent>
          </Popover>
        ) : null}
        <Popover
          onOpenChange={(open) => setOpenPopover(open ? "background" : null)}
          open={openPopover === "background"}
        >
          <PopoverTrigger asChild>
            <button
              aria-label={t("customBackground")}
              className="flex size-6 items-center justify-center rounded"
              onMouseDown={(event) => event.stopPropagation()}
              title={t("customBackground")}
              type="button"
            >
              <span
                className="size-3.5 rounded-full border-2 border-muted-foreground/40"
                style={{ backgroundColor: backgroundLight }}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 rounded-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <ColorPicker
              className="gap-3"
              onChange={(rgba) => setCustomBackground(rgbaToHex(rgba as number[]))}
              value={backgroundLight}
            >
              <ColorPickerSelection className="h-32" />
              <ColorPickerHue />
              <div className="flex items-center gap-2">
                <ColorPickerEyeDropper />
                <ColorPickerOutput />
              </div>
              <ColorPickerFormat />
            </ColorPicker>
            {customBackground ? (
              <button
                className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setCustomBackground(null)}
                type="button"
              >
                {t("resetBackground")}
              </button>
            ) : null}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          aria-label={tBlock("delete", { type: tBlock("types.callout") })}
          title={tBlock("delete", { type: tBlock("types.callout") })}
          onClick={deleteNode}
          onMouseDown={(event) => event.stopPropagation()}
          className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}
