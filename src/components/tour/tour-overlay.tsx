"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquareWarning,
  Pilcrow,
  Quote,
  Redo2,
  Sigma,
  SquareAsterisk,
  SquareSigma,
  Strikethrough,
  Table as TableIcon,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/lib/i18n/navigation";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useRightPanelTabStore } from "@/lib/stores/ui-store";
import { useEditorBridge } from "@/lib/stores/editor-bridge";
import { useSlashMenuStore } from "@/lib/stores/slash-menu-store";
import { useCrossRefMenuStore } from "@/lib/stores/cross-ref-menu-store";
import {
  TOUR_STEPS,
  TOUR_TAB_IDS,
  hasSeenTour,
  useTourStore,
  type TourStepId,
} from "@/lib/stores/tour-store";

// Mirrors tiptap-toolbar.tsx's button groups exactly (same icons, same
// order, same data-tour-toolbar-group="N" wrapper each icon's group
// spotlights against) and reuses its i18n keys (editor.toolbar.*) so each
// item's label is guaranteed to match its real tooltip in the toolbar
// itself, rather than a second hand-written copy that could drift.
type ToolbarItem = { icon: ComponentType<{ className?: string }>; key: string };
const TOOLBAR_GROUPS: ToolbarItem[][] = [
  [
    { icon: Pilcrow, key: "paragraph" },
    { icon: Heading1, key: "heading1" },
    { icon: Heading2, key: "heading2" },
    { icon: Heading3, key: "heading3" },
  ],
  [
    { icon: Bold, key: "bold" },
    { icon: Italic, key: "italic" },
    { icon: SquareAsterisk, key: "footnote" },
    { icon: Strikethrough, key: "strike" },
    { icon: Code, key: "code" },
  ],
  [
    { icon: List, key: "bulletList" },
    { icon: ListOrdered, key: "orderedList" },
  ],
  [
    { icon: Quote, key: "blockquote" },
    { icon: MessageSquareWarning, key: "callout" },
    { icon: Code2, key: "codeBlock" },
    { icon: Link2, key: "link" },
    { icon: TableIcon, key: "table" },
    { icon: ImagePlus, key: "image" },
  ],
  [
    { icon: Sigma, key: "inlineMath" },
    { icon: SquareSigma, key: "blockMath" },
  ],
  [
    { icon: Undo2, key: "undo" },
    { icon: Redo2, key: "redo" },
  ],
];

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
  // Reuses the toolbar's own labels (bold/italic/footnote/…) so the tour
  // never shows a description that drifts from the real tooltip text.
  const tToolbar = useTranslations("editor.toolbar");
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
  const crossRefOpenCount = useCrossRefMenuStore((s) => s.openCount);
  // Drives the "panel" step's title/body: rather than one static blurb
  // covering all 5 right-panel tabs at once, the popover's text switches to
  // match whichever tab the user actually has open right now — mirrors the
  // "toolbar" step paging through its own groups, but driven by the user's
  // real navigation instead of the tour's own Next/Back.
  const rightPanelTab = useRightPanelTabStore((s) => s.tab);

  const [rect, setRect] = useState<Rect | null>(null);
  // Measured, not hardcoded — steps vary a lot in content length (the
  // toolbar step's bullet list is much taller than a one-line body), and a
  // fixed height guess would clip a tall popover off-screen or misplace it.
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverHeight, setPopoverHeight] = useState(220);
  const createBaselineRef = useRef<number | null>(null);
  const slashBaselineRef = useRef<number | null>(null);
  const inlineMathBaselineRef = useRef<number | null>(null);
  const blockMathBaselineRef = useRef<number | null>(null);
  const footnoteBaselineRef = useRef<number | null>(null);
  const crossRefBaselineRef = useRef<number | null>(null);
  const [inlineMathCount, setInlineMathCount] = useState(0);
  const [blockMathCount, setBlockMathCount] = useState(0);
  const [footnoteCount, setFootnoteCount] = useState(0);
  // The "toolbar" step pages through its groups one at a time instead of
  // dumping every group into one popover. `toolbarGroupsSeen` mirrors
  // `visitedTabs`'s Set-of-seen-items pattern (each group is its own "seen"
  // entry) so the progress count only grows — going Back to re-look at an
  // earlier group doesn't make the "already seen" count go backwards.
  const [toolbarGroupIndex, setToolbarGroupIndex] = useState(0);
  const [toolbarGroupsSeen, setToolbarGroupsSeen] = useState<Set<number>>(() => new Set([0]));

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

  useEffect(() => {
    if (active && step?.id === "footnote") {
      footnoteBaselineRef.current = countNodesOfType(editor, "footnoteReference");
    } else {
      footnoteBaselineRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step?.id]);

  // Baseline the @ cross-ref counter the same way slash's is baselined
  // above — re-entering the step (Back then Next again) shouldn't count an
  // @ opened in an earlier session.
  useEffect(() => {
    if (active && step?.id === "crossRef") {
      crossRefBaselineRef.current = crossRefOpenCount;
    } else {
      crossRefBaselineRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step?.id]);

  // Poll the document for math/footnote nodes while their step is active
  // (mirrors the anchor-measuring interval below; Tiptap content changes
  // don't otherwise trigger a re-render here).
  useEffect(() => {
    if (
      !active ||
      (step?.id !== "mathInline" && step?.id !== "mathBlock" && step?.id !== "footnote")
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      setInlineMathCount(countNodesOfType(editor, "inlineMath"));
      setBlockMathCount(countNodesOfType(editor, "blockMath"));
      setFootnoteCount(countNodesOfType(editor, "footnoteReference"));
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

  // Reset the toolbar sub-step to the first group each time the step is
  // (re-)entered, so Back-ing into it from "slash" starts over rather than
  // resuming wherever it was left.
  useEffect(() => {
    if (active && step?.id === "toolbar") {
      setToolbarGroupIndex(0);
      setToolbarGroupsSeen(new Set([0]));
    }
  }, [active, step?.id]);

  // Add the current group to the seen-set whenever it changes (covers both
  // Next and Back — Back-ing into a group you've already seen is a no-op
  // add, Back-ing into a genuinely new one, e.g. after a reset, still counts).
  useEffect(() => {
    if (active && step?.id === "toolbar") {
      setToolbarGroupsSeen((prev) =>
        prev.has(toolbarGroupIndex) ? prev : new Set(prev).add(toolbarGroupIndex),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step?.id, toolbarGroupIndex]);

  // Mark the default-visible tab as seen when entering the panel step.
  useEffect(() => {
    if (active && step?.id === "panel") {
      markTabVisited(TOUR_TAB_IDS[0]);
    }
  }, [active, step?.id, markTabVisited]);

  // Measure the anchor; poll until it exists (handles cross-route mount).
  // On the "toolbar" step, spotlight just the current group (each button
  // cluster is wrapped with data-tour-toolbar-group="N" in
  // tiptap-toolbar.tsx) instead of the whole toolbar.
  const measure = useCallback(() => {
    if (!step) return;
    const selector =
      step.id === "toolbar"
        ? `[data-tour-toolbar-group="${toolbarGroupIndex}"]`
        : step.anchor;
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step, toolbarGroupIndex]);

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

  // Re-measure the popover's actual height whenever the step (and therefore
  // its content) changes, so the position clamp below reflects reality.
  useLayoutEffect(() => {
    const h = popoverRef.current?.offsetHeight;
    if (h && h !== popoverHeight) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPopoverHeight(h);
    }
  });

  // If a doc-scoped anchor never shows (replay from list page), open the first document.
  useEffect(() => {
    if (!active || !step) return;
    const docScopedSteps: TourStepId[] = [
      "toolbar",
      "slash",
      "mathInline",
      "mathBlock",
      "footnote",
      "crossRef",
      "imageCrop",
      "panel",
    ];
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
  const footnotePending =
    step.id === "footnote" &&
    footnoteBaselineRef.current !== null &&
    footnoteCount <= footnoteBaselineRef.current;
  const crossRefPending =
    step.id === "crossRef" &&
    crossRefBaselineRef.current !== null &&
    crossRefOpenCount <= crossRefBaselineRef.current;
  const nextDisabled =
    forcedCreatePending ||
    tabsPending ||
    slashPending ||
    mathInlinePending ||
    mathBlockPending ||
    footnotePending ||
    crossRefPending;

  // "toolbar" pages through its groups via the same Next/Back buttons before
  // they fall through to the normal step-advance behavior — never disabled
  // (that would deadlock, since paging is the only way to reach "seen all"),
  // just redirected to increment/decrement the sub-step first.
  const isToolbarStep = step.id === "toolbar";
  const toolbarHasMoreForward = isToolbarStep && toolbarGroupIndex < TOOLBAR_GROUPS.length - 1;
  const toolbarHasMoreBack = isToolbarStep && toolbarGroupIndex > 0;

  function handleNext() {
    if (toolbarHasMoreForward) {
      setToolbarGroupIndex((i) => i + 1);
      return;
    }
    next();
  }

  function handleBack() {
    if (toolbarHasMoreBack) {
      setToolbarGroupIndex((i) => i - 1);
      return;
    }
    back();
  }

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
    if (padded && popTop + popoverHeight > vh) {
      popTop = Math.max(12, padded.top - popoverHeight);
    }
  }
  popLeft = Math.min(Math.max(12, popLeft), vw - popoverWidth - 12);
  popTop = Math.min(Math.max(12, popTop), vh - popoverHeight - 12);

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
        <p className="text-sm font-semibold">
          {step.id === "panel"
            ? t(`steps.panel.tabs.${rightPanelTab}.title` as never)
            : t(`steps.${step.id}.title`)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {step.id === "panel"
            ? t(`steps.panel.tabs.${rightPanelTab}.body` as never)
            : t(`steps.${step.id}.body`)}
        </p>
        {step.id === "toolbar" ? (
          <>
            <p className="mt-3 text-sm font-medium">
              {(t.raw("steps.toolbar.groups") as string[])[toolbarGroupIndex]}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {TOOLBAR_GROUPS[toolbarGroupIndex]?.map(({ icon: Icon, key }) => (
                <li key={key} className="flex items-start gap-2 text-sm">
                  <Icon className="mt-0.5 size-4 shrink-0 text-foreground" />
                  <span>
                    <span className="text-foreground">{tToolbar(key as never)}</span>
                    <span className="text-muted-foreground">
                      ：{t(`itemHints.${key}` as never)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-medium text-primary">
              {t("tabsProgress", {
                visited: toolbarGroupsSeen.size,
                total: TOOLBAR_GROUPS.length,
              })}
            </p>
          </>
        ) : null}

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
        {footnotePending ? (
          <p className="mt-2 text-xs font-medium text-primary">{t("footnoteHint")}</p>
        ) : null}
        {crossRefPending ? (
          <p className="mt-2 text-xs font-medium text-primary">{t("crossRefHint")}</p>
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
              <Button size="sm" variant="ghost" onClick={handleBack}>
                {t("back")}
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={isLastStep ? finish : handleNext}
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
