import { beforeEach, describe, expect, it } from "vitest";
import { useFeatureGuideStore } from "@/lib/stores/feature-guide-store";
import {
  useRightPanelTabStore,
  useSettingsDialogStore,
} from "@/lib/stores/ui-store";
import {
  dismissFeatureGuide,
  startFeatureGuide,
} from "./feature-guide";
import type { ResolvedFeature } from "./feature-search";

const documentFeature: ResolvedFeature = {
  id: "editor.pageBreak",
  label: "分頁",
  description: "在目前位置開始新的一頁",
  path: "編輯器 › 工具列 › 分頁",
  keywords: ["換頁"],
  availability: "document",
  guide: {
    targetId: "editor.pageBreak.forced",
    reveal: { kind: "menu", menuId: "editor.pageBreak" },
  },
};

beforeEach(() => {
  useFeatureGuideStore.setState({ active: null });
  useSettingsDialogStore.setState({ open: false, category: "appearance" });
  useRightPanelTabStore.setState({ tab: "outline" });
});

describe("startFeatureGuide", () => {
  it("refuses unavailable contexts without changing UI state", () => {
    expect(
      startFeatureGuide(documentFeature, {
        documentId: null,
        isDesktop: false,
      }),
    ).toEqual({ ok: false, reason: "document-required" });
    expect(useFeatureGuideStore.getState().active).toBeNull();

    expect(
      startFeatureGuide(
        { ...documentFeature, availability: "desktop" },
        { documentId: "doc-1", isDesktop: false },
      ),
    ).toEqual({ ok: false, reason: "desktop-required" });
  });

  it("opens settings and right-panel surfaces before targeting them", () => {
    const settingsFeature: ResolvedFeature = {
      ...documentFeature,
      id: "settings.backup",
      availability: "global",
      guide: {
        targetId: "settings.backup",
        reveal: { kind: "settings", category: "backup" },
      },
    };
    const panelFeature: ResolvedFeature = {
      ...documentFeature,
      id: "panel.history",
      guide: {
        targetId: "panel.history",
        reveal: { kind: "right-panel", tab: "history" },
      },
    };

    expect(
      startFeatureGuide(settingsFeature, {
        documentId: null,
        isDesktop: false,
      }),
    ).toEqual({ ok: true });
    expect(useSettingsDialogStore.getState()).toMatchObject({
      open: true,
      category: "backup",
    });

    expect(
      startFeatureGuide(panelFeature, {
        documentId: "doc-1",
        isDesktop: false,
      }),
    ).toEqual({ ok: true });
    expect(useRightPanelTabStore.getState().tab).toBe("history");
    expect(useFeatureGuideStore.getState().active?.featureId).toBe(
      "panel.history",
    );
  });

  it("replaces and dismisses active guides deterministically", () => {
    startFeatureGuide(documentFeature, {
      documentId: "doc-1",
      isDesktop: false,
    });
    const replacement = { ...documentFeature, id: "editor.bold" };
    startFeatureGuide(replacement, {
      documentId: "doc-1",
      isDesktop: false,
    });

    expect(useFeatureGuideStore.getState().active?.featureId).toBe(
      "editor.bold",
    );
    dismissFeatureGuide();
    expect(useFeatureGuideStore.getState().active).toBeNull();
  });
});
