import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Command, CommandList } from "@/components/ui/command";
import type { ResolvedFeature } from "@/lib/features/feature-search";
import { FeatureSearchGroup } from "./feature-search-group";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    if (key === "group") return "功能";
    if (key === "noMatch") return "找不到想要的功能？換其他關鍵字試試？";
    return key;
  },
}));

const features: ResolvedFeature[] = [
  {
    id: "editor.pageBreak",
    label: "強制分頁",
    description: "一律從下一頁開始",
    path: "編輯器 › 工具列",
    keywords: ["換頁"],
    availability: "document",
    guide: { targetId: "editor.pageBreak" },
  },
];

describe("FeatureSearchGroup", () => {
  it("shows feature context and returns the selected feature", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Command>
        <CommandList>
          <FeatureSearchGroup
            query="換頁"
            features={features}
            onSelect={onSelect}
          />
        </CommandList>
      </Command>,
    );

    expect(screen.getByText("功能")).toBeInTheDocument();
    expect(screen.getByText("強制分頁")).toBeInTheDocument();
    expect(screen.getByText("一律從下一頁開始")).toBeInTheDocument();
    expect(screen.getByText("編輯器 › 工具列")).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /強制分頁/ }));
    expect(onSelect).toHaveBeenCalledWith(features[0]);
  });

  it("shows the approved feature-specific empty copy", () => {
    render(
      <Command>
        <CommandList>
          <FeatureSearchGroup
            query="不存在"
            features={features}
            onSelect={() => undefined}
          />
        </CommandList>
      </Command>,
    );

    expect(
      screen.getByText("找不到想要的功能？換其他關鍵字試試？"),
    ).toBeInTheDocument();
  });
});
