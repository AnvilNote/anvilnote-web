"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/lib/i18n/navigation";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useEditorBridge } from "@/lib/stores/editor-bridge";
import { useSlashMenuStore } from "@/lib/stores/slash-menu-store";
import {
  TOUR_STEPS,
  TOUR_TAB_IDS,
  hasSeenTour,
  useTourStore,
  type TourStepId,
} from "@/lib/stores/tour-store";

// Counts nodes of a given type currently in the document, so forced math
// steps can detect "the user typed a $$..$$ / $$$..$$$ shortcut" without the
// tour needing to hook into the input rules themselves.
function countNodesOfType(editor: Editor | null, typeName: string): number {
  if (!editor) return 0;
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === typeName) count += 1;
  });
  return count;
}

type Rect = { top: number; left: number; width: number; height: number };

const SPOTLIGHT_PADDING = 8;
const ANCHOR_POLL_MS = 120;
const ANCHOR_NAV_TIMEOUT_MS = 1500;
const LG_QUERY = "(min-width: 1024px)";

function isDesktop(): boolean {
  return typeof window !== "undefined" && window.matchMedia(LG_QUERY).matches;
}

export function TourOverlay() {
  const t = useTranslations("tour");
  const router = useRouter();

  const active = useTourStore((s) => s.active);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const visitedTabs = useTourStore((s) => s.visitedTabs);
  const start = useTourStore((s) => s.start);
  const next = useTourStore((s) => s.next);
  const back = useTourStore((s) => s.back);
  const skip = useTourStore((s) => s.skip);
  const finish = useTourStore((s) => s.finish);
  const markTabVisited = useTourStore((s) => s.markTabVisited);

  const documents = useDocumentStore((s) => s.documents);
  const hydrated = useDocumentStore((s) => s.hydrated);
  const editor = useEditorBridge((s) => s.editor);
  const slashOpenCount = useSlashMenuStore((s) => s.openCount);

  const [rect, setRect] = useState<Rect | null>(null);
  const createBaselineRef = useRef<number | null>(null);
  const slashBaselineRef = useRef<number | null>(null);
  const inlineMathBaselineRef = useRef<number | null>(null);
  const blockMathBaselineRef = useRef<number | null>(null);
  const [inlineMathCount, setInlineMathCount] = useState(0);
  const [blockMathCount, setBlockMathCount] = useState(0);

  const step = TOUR_STEPS[stepIndex];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  // Auto-start once: new user, no documents, desktop only.
  useEffect(() => {
    if (!hydrated) return;
    if (hasSeenTour()) return;
    if (documents.length > 0) return;
    if (!isDesktop()) return;
    start();
  }, [hydrated, documents.length, start]);

  // Track document count when entering the forced "create" step so we can detect creation.
  useEffect(() => {
    if (active && step?.id === "newDoc") {
      createBaselineRef.current = documents.length;
    } else {
      createBaselineRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step?.id]);

  // Baseline the slash-menu open counter and the two math node counters when
  // entering their respective forced steps, so re-entering a step (Back then
  // Next again) doesn't count a shortcut typed in an earlier session.
  useEffect(() => {
    if (active && step?.id === "slash") {
      slashBaselineRef.current = slashOpenCount;
    } else {
      slashBaselineRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step?.id]);

  useEffect(() => {
    if (active && step?.id === "mathInline") {
      inlineMathBaselineRef.current = countNodesOfType(editor, "inlineMath");
    } else {
      inlineMathBaselineRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step?.id]);

  useEffect(() => {
    if (active && step?.id === "mathBlock") {
      blockMathBaselineRef.current = countNodesOfType(editor, "blockMath");
    } else {
      blockMathBaselineRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step?.id]);

  // Poll the document for math nodes while a math step is active (mirrors the
  // anchor-measuring interval below; Tiptap content changes don't otherwise
  // trigger a re-render here).
  useEffect(() => {
    if (!active || (step?.id !== "mathInline" && step?.id !== "mathBlock")) return;
    const interval = window.setInterval(() => {
      setInlineMathCount(countNodesOfType(editor, "inlineMath"));
      setBlockMathCount(countNodesOfType(editor, "blockMath"));
    }, ANCHOR_POLL_MS);
    return () => window.clearInterval(interval);
  }, [active, step?.id, editor]);

  // Forced "create": when a document appears, advance and open it.
  useEffect(() => {
    if (!active || step?.id !== "newDoc") return;
    const baseline = createBaselineRef.current;
    if (baseline === null) return;
    if (documents.length > baseline) {
      const created = documents[documents.length - 1];
      next();
      if (created) router.push(`/documents/${created.id}`);
    }
  }, [active, step?.id, documents, next, router]);

  // Mark the default-visible tab as seen when entering the panel step.
  useEffect(() => {
    if (active && step?.id === "panel") {
      markTabVisited(TOUR_TAB_IDS[0]);
    }
  }, [active, step?.id, markTabVisited]);

  // Measure the anchor; poll until it exists (handles cross-route mount).
  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(step.anchor);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (!active || !step) return;
    // Measuring the anchor and syncing its rect into state is the effect's purpose.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    const interval = window.setInterval(measure, ANCHOR_POLL_MS);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step, measure]);

  // If a doc-scoped anchor never shows (replay from list page), open the first document.
  useEffect(() => {
    if (!active || !step) return;
    const docScopedSteps: TourStepId[] = ["toolbar", "slash", "mathInline", "mathBlock", "panel"];
    if (!docScopedSteps.includes(step.id)) return;
    if (rect) return;
    const timer = window.setTimeout(() => {
      const stillMissing = !document.querySelector(step.anchor);
      if (stillMissing && documents.length > 0) {
        router.push(`/documents/${documents[0].id}`);
      }
    }, ANCHOR_NAV_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [active, step, rect, documents, router]);

  if (!active || !step || typeof document === "undefined") return null;

  const forcedCreatePending = step.id === "newDoc" && documents.length === 0;
  const tabsPending = step.id === "panel" && visitedTabs.length < TOUR_TAB_IDS.length;
  const slashPending =
    step.id === "slash" &&
    slashBaselineRef.current !== null &&
    slashOpenCount <= slashBaselineRef.current;
  const mathInlinePending =
    step.id === "mathInline" &&
    inlineMathBaselineRef.current !== null &&
    inlineMathCount <= inlineMathBaselineRef.current;
  const mathBlockPending =
    step.id === "mathBlock" &&
    blockMathBaselineRef.current !== null &&
    blockMathCount <= blockMathBaselineRef.current;
  const nextDisabled =
    forcedCreatePending || tabsPending || slashPending || mathInlinePending || mathBlockPending;

  const padded: Rect | null = rect
    ? {
        top: rect.top - SPOTLIGHT_PADDING,
        left: rect.left - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  // Place the popover below the anchor by default, clamped into the viewport.
  const popoverWidth = 320;
  const popoverGap = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // If the anchor sits against the right edge (e.g. the right panel), the popover
  // would cover it — place it to the left of the anchor instead.
  const placeLeftOfAnchor =
    !!padded && padded.left + padded.width + popoverGap + popoverWidth > vw;

  let popTop: number;
  let popLeft: number;
  if (placeLeftOfAnchor && padded) {
    popTop = padded.top;
    popLeft = padded.left - popoverWidth - popoverGap;
  } else {
    popTop = padded ? padded.top + padded.height + 12 : vh / 2 - 80;
    popLeft = padded ? padded.left : vw / 2 - popoverWidth / 2;
    if (padded && popTop + 220 > vh) {
      popTop = Math.max(12, padded.top - 220);
    }
  }
  popLeft = Math.min(Math.max(12, popLeft), vw - popoverWidth - 12);
  popTop = Math.min(Math.max(12, popTop), vh - 232);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {/* Dim + spotlight (visual only; underlying page stays interactive). */}
      {padded ? (
        <div
          className="absolute rounded-xl transition-all duration-200"
          style={{
            top: padded.top,
            left: padded.left,
            width: padded.width,
            height: padded.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}

      {/* Popover */}
      <div
        role="dialog"
        aria-modal="false"
        className="pointer-events-auto absolute rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl"
        style={{ top: popTop, left: popLeft, width: popoverWidth }}
      >
        <p className="text-sm font-semibold">{t(`steps.${step.id}.title`)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(`steps.${step.id}.body`)}
        </p>

        {forcedCreatePending ? (
          <p className="mt-2 text-xs font-medium text-primary">{t("createHint")}</p>
        ) : null}
        {slashPending ? (
          <p className="mt-2 text-xs font-medium text-primary">{t("slashHint")}</p>
        ) : null}
        {mathInlinePending ? (
          <p className="mt-2 text-xs font-medium text-primary">{t("mathInlineHint")}</p>
        ) : null}
        {mathBlockPending ? (
          <p className="mt-2 text-xs font-medium text-primary">{t("mathBlockHint")}</p>
        ) : null}
        {step.id === "panel" ? (
          <p className="mt-2 text-xs font-medium text-primary">
            {t("tabsProgress", {
              visited: Math.min(visitedTabs.length, TOUR_TAB_IDS.length),
              total: TOUR_TAB_IDS.length,
            })}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={skip}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t("skip")}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("step", { current: stepIndex + 1, total: TOUR_STEPS.length })}
            </span>
            {stepIndex > 0 ? (
              <Button size="sm" variant="ghost" onClick={back}>
                {t("back")}
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={isLastStep ? finish : next}
              disabled={nextDisabled}
            >
              {isLastStep ? t("done") : t("next")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
