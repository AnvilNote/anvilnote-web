"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { useTranslations } from "next-intl";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/color-picker";

const DEFAULT_SWATCH_COLOR = "#000000";

// Floats just below the current selection, mirroring link-input.tsx's
// approach: the selection range + screen position are captured once on
// mount (before focus moves into the picker's own controls), then
// re-applied via setTextSelection before dispatching setColor/unsetColor —
// the picker's sliders/canvas take DOM focus away from the editor while
// dragging, so the live editor selection can't be trusted to still point
// at the marked text by the time a color change commits.
export function TextColorPicker({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const t = useTranslations("editor.block");
  const [range] = useState(() => {
    const { from, to } = editor.state.selection;
    return { from, to };
  });
  const [position] = useState(() => {
    const { from, to } = editor.state.selection;
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    return {
      left: Math.min(start.left, end.left),
      top: Math.max(start.bottom, end.bottom),
    };
  });
  const currentColor =
    (editor.getAttributes("textStyle").color as string | undefined) ?? DEFAULT_SWATCH_COLOR;

  // No .focus() here — this fires continuously while dragging the picker's
  // hue/saturation controls, and refocusing the editor on every step would
  // fight the picker's own pointer-drag handling for no benefit (the
  // ProseMirror selection persists across a DOM focus change on its own).
  function applyColor(hex: string) {
    editor.chain().setTextSelection(range).setColor(hex).run();
  }

  function close() {
    editor.chain().focus().setTextSelection(range).run();
    onClose();
  }

  function reset() {
    editor.chain().focus().setTextSelection(range).unsetColor().run();
    onClose();
  }

  // Portaled to document.body, not rendered in place — see link-input.tsx's
  // identical comment: `transform-gpu` on an editor-column ancestor (kept
  // for the pinned footnotes panel) becomes the containing block for any
  // `position: fixed` descendant, silently offsetting viewport-relative
  // coordinates like coordsAtPos unless this escapes that subtree.
  return createPortal(
    <>
      {/* Click-away layer closes without discarding the color already applied
          live while dragging — unlike LinkInput's click-away, there's no
          separate "commit" step here to skip. */}
      <div className="fixed inset-0 z-40" onMouseDown={close} />
      <div
        style={{
          position: "fixed",
          left: position.left,
          top: position.top + 6,
          zIndex: 50,
        }}
        className="w-64 rounded-lg border bg-popover p-3 shadow-md"
      >
        <ColorPicker
          value={currentColor}
          onChange={(rgba) => {
            const [r, g, b] = rgba as [number, number, number, number];
            const hex = `#${[r, g, b]
              .map((c) => Math.round(c).toString(16).padStart(2, "0"))
              .join("")}`;
            applyColor(hex);
          }}
          className="gap-3"
        >
          <ColorPickerSelection className="h-32" />
          <ColorPickerHue />
          <div className="flex items-center gap-2">
            <ColorPickerEyeDropper />
            <ColorPickerOutput />
          </div>
          <ColorPickerFormat />
        </ColorPicker>
        <button
          type="button"
          onClick={reset}
          className="mt-3 w-full rounded-md border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {t("colors.default")}
        </button>
      </div>
    </>,
    document.body,
  );
}
