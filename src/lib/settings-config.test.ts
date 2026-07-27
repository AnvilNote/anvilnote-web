import { describe, expect, test } from "vitest";
import { importSettingsConfig } from "./settings-config";

describe("settings config import", () => {
  test("keeps recognized fields with valid values", async () => {
    const config = await importSettingsConfig(
      JSON.stringify({
        autosave: false,
        exportPageSize: "Letter",
        orderedListLevels: ["roman-upper", "thai-consonant"],
        unorderedListLevels: ["▲", "◆"],
      }),
    );
    expect(config).toEqual({
      autosave: false,
      exportPageSize: "Letter",
      orderedListLevels: ["roman-upper", "thai-consonant"],
      unorderedListLevels: ["▲", "◆"],
    });
  });

  test("drops unrecognized keys and mistyped values instead of failing", async () => {
    const config = await importSettingsConfig(
      JSON.stringify({
        autosave: true,
        exportPageSize: "Legal", // not a real option
        someFutureField: "from a newer app version",
        orderedListLevels: ["not-a-real-module"],
      }),
    );
    expect(config).toEqual({ autosave: true });
  });

  test("tourButtonPosition: accepts null or a valid object", async () => {
    expect((await importSettingsConfig(JSON.stringify({ tourButtonPosition: null }))))
      .toEqual({ tourButtonPosition: null });
    expect(
      await importSettingsConfig(
        JSON.stringify({ tourButtonPosition: { right: 10, bottom: 20 } }),
      ),
    ).toEqual({ tourButtonPosition: { right: 10, bottom: 20 } });
  });

  test("rejects non-object JSON", async () => {
    await expect(importSettingsConfig(JSON.stringify([1, 2, 3]))).rejects.toThrow();
    await expect(importSettingsConfig(JSON.stringify("hello"))).rejects.toThrow();
  });

  test("throws on invalid JSON", async () => {
    await expect(importSettingsConfig("not json")).rejects.toThrow();
  });
});
