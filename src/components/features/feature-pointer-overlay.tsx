"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useFeatureGuideStore } from "@/lib/stores/feature-guide-store";

const GUIDE_DURATION_MS = 5_000;
const TARGET_WAIT_MS = 2_000;
const POINTER_HALF_WIDTH = 88;

function targetSelector(targetId: string): string {
  const escaped = targetId.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `[data-feature-id="${escaped}"]`;
}

function findVisibleTarget(targetId: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    targetSelector(targetId),
  );
  return (
    Array.from(candidates).find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) ?? null
  );
}

export function FeaturePointerOverlay() {
  const t = useTranslations("featureFinder");
  const active = useFeatureGuideStore((state) => state.active);
  const dismiss = useFeatureGuideStore((state) => state.dismiss);
  const [measurement, setMeasurement] = useState<{
    requestId: number;
    rect: DOMRect;
  } | null>(null);
  const targetUnavailableMessage = t("targetUnavailable");

  useEffect(() => {
    if (!active) return;

    let target: HTMLElement | null = null;
    let guideTimer: number | undefined;
    let unavailableTimer: number | undefined;
    let observer: MutationObserver | undefined;

    const updateRect = () => {
      if (target?.isConnected) {
        setMeasurement({
          requestId: active.requestId,
          rect: target.getBoundingClientRect(),
        });
      }
    };
    const onTargetClick = () => dismiss();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };

    const attach = (): boolean => {
      const candidate = findVisibleTarget(active.targetId);
      if (!candidate) return false;

      target = candidate;
      observer?.disconnect();
      window.clearTimeout(unavailableTimer);
      target.scrollIntoView?.({ behavior: "smooth", block: "center" });
      updateRect();
      target.addEventListener("click", onTargetClick);
      window.addEventListener("resize", updateRect);
      window.addEventListener("scroll", updateRect, true);
      document.addEventListener("keydown", onKeyDown);
      guideTimer = window.setTimeout(dismiss, GUIDE_DURATION_MS);
      return true;
    };

    if (!attach()) {
      observer = new MutationObserver(() => {
        attach();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      unavailableTimer = window.setTimeout(() => {
        observer?.disconnect();
        toast.error(targetUnavailableMessage);
        dismiss();
      }, TARGET_WAIT_MS);
    }

    return () => {
      observer?.disconnect();
      window.clearTimeout(guideTimer);
      window.clearTimeout(unavailableTimer);
      target?.removeEventListener("click", onTargetClick);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active, dismiss, targetUnavailableMessage]);

  const targetRect =
    active && measurement?.requestId === active.requestId
      ? measurement.rect
      : null;

  if (!active || !targetRect) return null;

  const viewportWidth =
    typeof window === "undefined" ? 1024 : window.innerWidth;
  const center = targetRect.left + targetRect.width / 2;
  const pointerLeft = Math.min(
    Math.max(center, POINTER_HALF_WIDTH),
    viewportWidth - POINTER_HALF_WIDTH,
  );
  const showBelow = targetRect.top < 64;
  const pointerTop = showBelow
    ? targetRect.bottom + 10
    : Math.max(8, targetRect.top - 48);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div
        aria-hidden="true"
        className="fixed rounded-md animate-pulse"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          boxShadow:
            "0 0 0 2px #939bc9, 0 0 0 7px color-mix(in oklab, #939bc9 20%, transparent)",
        }}
      />
      <div
        role="status"
        aria-live="polite"
        className="fixed flex w-max -translate-x-1/2 flex-col items-center whitespace-nowrap text-xs font-medium text-white drop-shadow-sm"
        style={{ top: pointerTop, left: pointerLeft }}
      >
        {showBelow ? (
          <ArrowUp aria-hidden="true" className="mb-0.5 size-4 text-[#939bc9]" />
        ) : null}
        <span className="rounded-full bg-[#939bc9] px-3 py-1.5 shadow-lg">
          {t("here", { feature: active.label })}
        </span>
        {!showBelow ? (
          <ArrowDown
            aria-hidden="true"
            className="mt-0.5 size-4 text-[#939bc9]"
          />
        ) : null}
      </div>
    </div>
  );
}
