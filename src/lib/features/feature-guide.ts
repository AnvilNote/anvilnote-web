import { useFeatureGuideStore } from "@/lib/stores/feature-guide-store";
import {
  useRightPanelTabStore,
  useSettingsDialogStore,
  useUiStore,
} from "@/lib/stores/ui-store";
import type { ResolvedFeature } from "./feature-search";

export type FeatureGuideContext = {
  documentId: string | null;
  isDesktop: boolean;
};

export type FeatureGuideStartResult =
  | { ok: true }
  | {
      ok: false;
      reason: "document-required" | "desktop-required";
    };

let requestSequence = 0;

export function startFeatureGuide(
  feature: ResolvedFeature,
  context: FeatureGuideContext,
): FeatureGuideStartResult {
  if (feature.availability === "document" && !context.documentId) {
    return { ok: false, reason: "document-required" };
  }
  if (feature.availability === "desktop" && !context.isDesktop) {
    return { ok: false, reason: "desktop-required" };
  }

  const reveal = feature.guide.reveal;
  if (reveal?.kind === "settings") {
    useSettingsDialogStore.getState().openSettings(reveal.category);
  } else if (reveal?.kind === "right-panel") {
    useRightPanelTabStore.getState().setTab(reveal.tab);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      useUiStore.getState().setMobilePanelOpen(true);
    }
  }

  requestSequence += 1;
  useFeatureGuideStore.getState().start({
    requestId: requestSequence,
    featureId: feature.id,
    label: feature.label,
    targetId: feature.guide.targetId,
    reveal,
  });

  return { ok: true };
}

export function dismissFeatureGuide(): void {
  useFeatureGuideStore.getState().dismiss();
}
