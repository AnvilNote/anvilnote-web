import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";
import ru from "../../../messages/ru.json";
import th from "../../../messages/th.json";
import zhTW from "../../../messages/zh-TW.json";
import {
  FEATURE_CATALOG,
  resolveFeatureCatalog,
  type FeatureTranslator,
} from "./feature-catalog";
import { searchFeatures, validateFeatureCatalog } from "./feature-search";

function translator(messages: object): FeatureTranslator {
  const resolve = (key: string): unknown =>
    key.split(".").reduce<unknown>((value, part) => {
      if (!value || typeof value !== "object") return undefined;
      return (value as Record<string, unknown>)[part];
    }, messages);

  const t = ((key: string) => {
    const value = resolve(key);
    if (typeof value !== "string") throw new Error(`Missing message: ${key}`);
    return value;
  }) as FeatureTranslator;
  t.raw = resolve;
  return t;
}

describe("FEATURE_CATALOG", () => {
  it("resolves every entry in every supported locale", () => {
    for (const messages of [en, ja, ko, ru, th, zhTW]) {
      const resolved = resolveFeatureCatalog(translator(messages));
      expect(resolved).toHaveLength(FEATURE_CATALOG.length);
      expect(() => validateFeatureCatalog(resolved)).not.toThrow();
      expect(
        resolved.every(
          (feature) =>
            feature.label &&
            feature.description &&
            feature.path &&
            feature.guide.targetId,
        ),
      ).toBe(true);
    }
  });

  it("finds representative editor, panel, settings, and help features", () => {
    const resolved = resolveFeatureCatalog(translator(zhTW));

    expect(searchFeatures(resolved, "換頁")[0]?.id).toBe(
      "editor.pageBreak.forced",
    );
    expect(searchFeatures(resolved, "版本").map((feature) => feature.id)).toContain(
      "panel.history",
    );
    expect(searchFeatures(resolved, "備份")[0]?.id).toBe("settings.backup");
    expect(searchFeatures(resolved, "教學")[0]?.id).toBe("help.tour");
    expect(searchFeatures(resolved, "統計圖")[0]?.id).toBe(
      "editor.statsChart",
    );
    expect(searchFeatures(resolved, "眼睛")[0]?.id).toBe(
      "panel.templatePreview",
    );
  });

  it("finds footnote by its reversed-order synonym, not just the literal label", () => {
    const resolved = resolveFeatureCatalog(translator(zhTW));

    // The feature's own label is "腳註" — "註腳" only matches at all because
    // it's in the curated keyword list (subsequence fuzzy matching alone
    // can't match a reordering of the label's own characters).
    expect(searchFeatures(resolved, "註腳").map((feature) => feature.id)).toContain(
      "editor.footnote",
    );
  });
});
