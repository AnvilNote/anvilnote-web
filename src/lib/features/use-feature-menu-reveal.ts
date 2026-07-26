"use client";

import { useState } from "react";
import { useFeatureGuideStore } from "@/lib/stores/feature-guide-store";

export function useFeatureMenuReveal(menuId: string) {
  const active = useFeatureGuideStore((state) => state.active);
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const guideOpen =
    active?.reveal?.kind === "menu" && active.reveal.menuId === menuId;

  return {
    open: manuallyOpen || guideOpen,
    setOpen: setManuallyOpen,
  };
}
