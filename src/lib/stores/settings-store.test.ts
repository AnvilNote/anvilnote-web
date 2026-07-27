import { beforeEach, describe, expect, test } from "vitest";
import { useSettingsStore } from "./settings-store";

// Only covers the new list-marker CRUD added alongside marker-modules.ts —
// the store's many pre-existing settings/setters are untouched and don't
// need re-testing here.
describe("settings store: list-marker level CRUD", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      orderedListLevels: ["arabic", "paren-arabic", "circled", "alpha-lower", "roman-lower"],
      unorderedListLevels: ["•", "◦", "▪", "–", "■"],
    });
  });

  test("defaults to 5 levels each", () => {
    expect(useSettingsStore.getState().orderedListLevels).toHaveLength(5);
    expect(useSettingsStore.getState().unorderedListLevels).toHaveLength(5);
  });

  test("setOrderedListLevel replaces only the targeted index", () => {
    useSettingsStore.getState().setOrderedListLevel(1, "roman-upper");
    expect(useSettingsStore.getState().orderedListLevels).toEqual([
      "arabic",
      "roman-upper",
      "circled",
      "alpha-lower",
      "roman-lower",
    ]);
  });

  test("addOrderedListLevel appends a new level", () => {
    useSettingsStore.getState().addOrderedListLevel("thai-consonant");
    expect(useSettingsStore.getState().orderedListLevels).toHaveLength(6);
    expect(useSettingsStore.getState().orderedListLevels.at(-1)).toBe("thai-consonant");
  });

  test("removeOrderedListLevel removes the targeted index", () => {
    useSettingsStore.getState().removeOrderedListLevel(2);
    expect(useSettingsStore.getState().orderedListLevels).toEqual([
      "arabic",
      "paren-arabic",
      "alpha-lower",
      "roman-lower",
    ]);
  });

  test("removeOrderedListLevel refuses to remove the last remaining level", () => {
    useSettingsStore.setState({ orderedListLevels: ["arabic"] });
    useSettingsStore.getState().removeOrderedListLevel(0);
    expect(useSettingsStore.getState().orderedListLevels).toEqual(["arabic"]);
  });

  test("setUnorderedListLevel replaces only the targeted index", () => {
    useSettingsStore.getState().setUnorderedListLevel(0, "▲");
    expect(useSettingsStore.getState().unorderedListLevels[0]).toBe("▲");
  });

  test("addUnorderedListLevel appends a new symbol", () => {
    useSettingsStore.getState().addUnorderedListLevel("◆");
    expect(useSettingsStore.getState().unorderedListLevels).toHaveLength(6);
  });

  test("removeUnorderedListLevel refuses to remove the last remaining level", () => {
    useSettingsStore.setState({ unorderedListLevels: ["•"] });
    useSettingsStore.getState().removeUnorderedListLevel(0);
    expect(useSettingsStore.getState().unorderedListLevels).toEqual(["•"]);
  });
});

describe("settings store: resetAllSettings", () => {
  test("restores every setting to its default value, not just list markers", () => {
    useSettingsStore.setState({
      autosave: false,
      spellcheck: false,
      exportPageSize: "Letter",
      defaultAuthor: "Someone",
      hideTourButton: true,
      aiModelId: "some-other-model",
      orderedListLevels: ["thai-consonant"],
      unorderedListLevels: ["▲"],
    });

    useSettingsStore.getState().resetAllSettings();

    const state = useSettingsStore.getState();
    expect(state.autosave).toBe(true);
    expect(state.spellcheck).toBe(true);
    expect(state.exportPageSize).toBe("A4");
    expect(state.defaultAuthor).toBe("");
    expect(state.hideTourButton).toBe(false);
    expect(state.aiModelId).toBe("gpt-5.6-terra");
    expect(state.orderedListLevels).toEqual([
      "arabic",
      "paren-arabic",
      "circled",
      "alpha-lower",
      "roman-lower",
    ]);
    expect(state.unorderedListLevels).toEqual(["•", "◦", "▪", "–", "■"]);
  });
});
