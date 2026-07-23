import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_CUSTOM_PALETTE_COLORS,
  useCustomPalettesStore,
} from "./custom-palettes-store";

describe("useCustomPalettesStore", () => {
  beforeEach(() => {
    useCustomPalettesStore.setState({ palettes: [] });
  });

  it("creates a new named palette with no colors", () => {
    const id = useCustomPalettesStore.getState().addPalette("我的配色");
    const palette = useCustomPalettesStore.getState().palettes.find((p) => p.id === id);
    expect(palette).toEqual({ id, name: "我的配色", colors: [] });
  });

  it("renames a palette", () => {
    const id = useCustomPalettesStore.getState().addPalette("Draft");
    useCustomPalettesStore.getState().renamePalette(id, "Final");
    expect(useCustomPalettesStore.getState().palettes.find((p) => p.id === id)?.name).toBe(
      "Final",
    );
  });

  it("removes a palette", () => {
    const id = useCustomPalettesStore.getState().addPalette("Temp");
    useCustomPalettesStore.getState().removePalette(id);
    expect(useCustomPalettesStore.getState().palettes).toHaveLength(0);
  });

  it("adds a color with a blank name when none is given", () => {
    const id = useCustomPalettesStore.getState().addPalette("P");
    useCustomPalettesStore.getState().addColor(id, "#ff0000");
    expect(useCustomPalettesStore.getState().palettes[0].colors).toEqual([
      { hex: "#ff0000", name: "" },
    ]);
  });

  it("adds a named color", () => {
    const id = useCustomPalettesStore.getState().addPalette("P");
    useCustomPalettesStore.getState().addColor(id, "#00ff00", "Grass");
    expect(useCustomPalettesStore.getState().palettes[0].colors).toEqual([
      { hex: "#00ff00", name: "Grass" },
    ]);
  });

  it("updates a color's hex and name", () => {
    const id = useCustomPalettesStore.getState().addPalette("P");
    useCustomPalettesStore.getState().addColor(id, "#111111");
    useCustomPalettesStore.getState().updateColor(id, 0, { hex: "#222222", name: "Slate" });
    expect(useCustomPalettesStore.getState().palettes[0].colors[0]).toEqual({
      hex: "#222222",
      name: "Slate",
    });
  });

  it("removes a color by index", () => {
    const id = useCustomPalettesStore.getState().addPalette("P");
    useCustomPalettesStore.getState().addColor(id, "#111111");
    useCustomPalettesStore.getState().addColor(id, "#222222");
    useCustomPalettesStore.getState().removeColor(id, 0);
    expect(useCustomPalettesStore.getState().palettes[0].colors).toEqual([
      { hex: "#222222", name: "" },
    ]);
  });

  it("does not add a color past the max cap", () => {
    const id = useCustomPalettesStore.getState().addPalette("P");
    for (let i = 0; i < MAX_CUSTOM_PALETTE_COLORS + 5; i += 1) {
      useCustomPalettesStore.getState().addColor(id, "#000000");
    }
    expect(useCustomPalettesStore.getState().palettes[0].colors).toHaveLength(
      MAX_CUSTOM_PALETTE_COLORS,
    );
  });
});
