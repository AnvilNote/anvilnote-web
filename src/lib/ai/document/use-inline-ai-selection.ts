"use client";

import type { Editor } from "@tiptap/core";
import { useLayoutEffect } from "react";
import { clearInlineAIDiff, showInlineAISelection } from "./inline-diff";

export type InlineAISelectionRange = { from: number; to: number };

/**
 * Apply the visual selection only after the composer has mounted. Tiptap's
 * decoration dispatch can synchronously re-render the BubbleMenu, so doing
 * this in the button handler races with the previous render's cleanup effect.
 */
export function useInlineAISelection(
  editor: Editor,
  state: {
    open: boolean;
    pending: boolean;
    range: InlineAISelectionRange | null;
  },
): void {
  useLayoutEffect(() => {
    if (state.open && state.range) {
      showInlineAISelection(editor, state.range);
      return;
    }
    if (!state.pending) clearInlineAIDiff(editor);
  }, [editor, state.open, state.pending, state.range]);
}
