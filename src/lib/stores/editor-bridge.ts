"use client";

import { create } from "zustand";
import type { Editor } from "@tiptap/core";
import type { MathClickMode } from "@/lib/tiptap/extensions";

// Bridges the mounted Tiptap editor to app-level UI (the global Cmd/Ctrl+K
// command menu). The editor registers itself on mount and clears on unmount, so
// editor-specific actions can be enabled only when a document is open.
type EditorBridgeState = {
  editor: Editor | null;
  // Opens the math editor dialog for a fresh insertion (no existing node).
  requestMath: ((mode: MathClickMode) => void) | null;
  register: (editor: Editor, requestMath: (mode: MathClickMode) => void) => void;
  unregister: (editor: Editor) => void;
};

export const useEditorBridge = create<EditorBridgeState>((set, get) => ({
  editor: null,
  requestMath: null,
  register: (editor, requestMath) => set({ editor, requestMath }),
  unregister: (editor) => {
    // Only clear if the unmounting editor is still the registered one; guards
    // against races when navigating between documents.
    if (get().editor === editor) {
      set({ editor: null, requestMath: null });
    }
  },
}));
