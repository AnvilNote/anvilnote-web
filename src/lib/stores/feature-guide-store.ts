"use client";

import { create } from "zustand";
import type { FeatureReveal } from "@/lib/features/feature-search";

export type ActiveFeatureGuide = {
  requestId: number;
  featureId: string;
  label: string;
  targetId: string;
  reveal?: FeatureReveal;
};

type FeatureGuideState = {
  active: ActiveFeatureGuide | null;
  start: (guide: ActiveFeatureGuide) => void;
  dismiss: () => void;
};

export const useFeatureGuideStore = create<FeatureGuideState>((set) => ({
  active: null,
  start: (guide) => set({ active: guide }),
  dismiss: () => set({ active: null }),
}));
