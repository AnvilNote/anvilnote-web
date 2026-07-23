"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createId } from "@/lib/utils/ids";

export const MAX_CUSTOM_PALETTE_COLORS = 20;

export type CustomPaletteColor = {
  hex: string;
  // Blank when the user hasn't bothered naming this swatch — not optional,
  // so every color entry has the same shape everywhere it's read.
  name: string;
};

export type CustomPalette = {
  id: string;
  name: string;
  colors: CustomPaletteColor[];
};

type CustomPalettesState = {
  palettes: CustomPalette[];
  addPalette: (name: string) => string;
  renamePalette: (id: string, name: string) => void;
  removePalette: (id: string) => void;
  addColor: (paletteId: string, hex: string, name?: string) => void;
  updateColor: (paletteId: string, index: number, patch: Partial<CustomPaletteColor>) => void;
  removeColor: (paletteId: string, index: number) => void;
};

const STORAGE_KEY = "anvilnote.custom-palettes";

export const useCustomPalettesStore = create<CustomPalettesState>()(
  persist(
    (set) => ({
      palettes: [],

      addPalette: (name) => {
        const id = createId();
        set((state) => ({
          palettes: [...state.palettes, { id, name, colors: [] }],
        }));
        return id;
      },

      renamePalette: (id, name) => {
        set((state) => ({
          palettes: state.palettes.map((palette) =>
            palette.id === id ? { ...palette, name } : palette,
          ),
        }));
      },

      removePalette: (id) => {
        set((state) => ({
          palettes: state.palettes.filter((palette) => palette.id !== id),
        }));
      },

      addColor: (paletteId, hex, name) => {
        set((state) => ({
          palettes: state.palettes.map((palette) => {
            if (palette.id !== paletteId) return palette;
            if (palette.colors.length >= MAX_CUSTOM_PALETTE_COLORS) return palette;
            return { ...palette, colors: [...palette.colors, { hex, name: name ?? "" }] };
          }),
        }));
      },

      updateColor: (paletteId, index, patch) => {
        set((state) => ({
          palettes: state.palettes.map((palette) =>
            palette.id === paletteId
              ? {
                  ...palette,
                  colors: palette.colors.map((color, i) =>
                    i === index ? { ...color, ...patch } : color,
                  ),
                }
              : palette,
          ),
        }));
      },

      removeColor: (paletteId, index) => {
        set((state) => ({
          palettes: state.palettes.map((palette) =>
            palette.id === paletteId
              ? { ...palette, colors: palette.colors.filter((_, i) => i !== index) }
              : palette,
          ),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
