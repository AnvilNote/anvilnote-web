import { describe, expect, it } from "vitest";
import {
  searchFeatures,
  validateFeatureCatalog,
  type ResolvedFeature,
} from "./feature-search";

const features: ResolvedFeature[] = [
  {
    id: "editor.pageBreak",
    label: "分頁",
    description: "在目前位置開始新的一頁",
    path: "編輯器 › 工具列 › 分頁",
    keywords: ["換頁", "page break"],
    availability: "document",
    guide: { targetId: "editor.pageBreak.trigger" },
  },
  {
    id: "settings.backup",
    label: "備份與還原",
    description: "匯出或復原所有文件",
    path: "設定 › 備份",
    keywords: ["backup", "還原"],
    availability: "global",
    guide: {
      targetId: "settings.backup",
      reveal: { kind: "settings", category: "backup" },
    },
  },
  {
    id: "editor.bold",
    label: "粗體",
    description: "讓選取的文字變粗",
    path: "編輯器 › 工具列",
    keywords: ["加粗", "bold"],
    availability: "document",
    guide: { targetId: "editor.bold" },
  },
];

describe("searchFeatures", () => {
  it("ranks exact names before aliases and fuzzy matches", () => {
    expect(searchFeatures(features, "分頁").map((feature) => feature.id)).toEqual([
      "editor.pageBreak",
    ]);
    expect(searchFeatures(features, "換頁")[0]?.id).toBe("editor.pageBreak");
    expect(searchFeatures(features, "bkp")[0]?.id).toBe("settings.backup");
  });

  it("finds natural descriptions without calling an external service", () => {
    expect(searchFeatures(features, "文字變粗")[0]?.id).toBe("editor.bold");
  });

  it("returns nothing for a blank query and respects the result limit", () => {
    expect(searchFeatures(features, "   ")).toEqual([]);
    expect(searchFeatures(features, "a", 2)).toHaveLength(2);
  });
});

describe("validateFeatureCatalog", () => {
  it("rejects duplicate IDs and unknown reveal actions", () => {
    expect(() => validateFeatureCatalog([features[0], features[0]])).toThrow(
      /duplicate feature id/i,
    );
    expect(() =>
      validateFeatureCatalog([
        {
          ...features[0],
          id: "broken",
          guide: {
            targetId: "broken",
            reveal: { kind: "mystery" },
          } as never,
        },
      ]),
    ).toThrow(/unknown reveal action/i);
  });
});
