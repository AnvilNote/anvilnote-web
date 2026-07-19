import { create } from "zustand";

interface SmartModeUIState {
  open: boolean;
  activeConversationByDocument: Record<string, string | null | undefined>;
  inlineFallbackInstructionByDocument: Record<string, string | undefined>;
  // Bumps after an inline turn or a mutation made outside the right panel.
  // It deliberately carries no model-authored content or key data.
  conversationVersion: number;
  setOpen(open: boolean): void;
  setActiveConversation(documentId: string, conversationId: string | null): void;
  setInlineFallbackInstruction(documentId: string, instruction: string | null): void;
  notifyConversationChanged(): void;
}

/**
 * Ephemeral UI coordination only. This store is intentionally not persisted:
 * it lets floating controls avoid an open Smart Mode sheet without coupling
 * Smart Mode to the Tour's saved visibility or drag position.
 */
export const useSmartModeUIStore = create<SmartModeUIState>((set) => ({
  open: false,
  activeConversationByDocument: {},
  inlineFallbackInstructionByDocument: {},
  conversationVersion: 0,
  setOpen: (open) => set({ open }),
  setActiveConversation: (documentId, conversationId) => set((state) => ({
    activeConversationByDocument: {
      ...state.activeConversationByDocument,
      [documentId]: conversationId,
    },
  })),
  setInlineFallbackInstruction: (documentId, instruction) => set((state) => ({
    inlineFallbackInstructionByDocument: {
      ...state.inlineFallbackInstructionByDocument,
      ...(instruction ? { [documentId]: instruction } : { [documentId]: undefined }),
    },
  })),
  notifyConversationChanged: () => set((state) => ({
    conversationVersion: state.conversationVersion + 1,
  })),
}));
