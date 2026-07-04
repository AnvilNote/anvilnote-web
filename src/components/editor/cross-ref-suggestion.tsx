"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Extension, type Editor } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { FileImage, Hash, Sigma, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { insertCrossRef, type CrossRefKind } from "@/lib/tiptap/cross-ref";
import { useCrossRefMenuStore } from "@/lib/stores/cross-ref-menu-store";

type CrossRefTarget = {
  id: string;
  kind: CrossRefKind;
  label: string;
};

const KIND_ICON = {
  figure: FileImage,
  table: Table2,
  equation: Sigma,
  heading: Hash,
} as const;

const KIND_ORDER: CrossRefKind[] = ["heading", "figure", "table", "equation"];

// Walks the current doc for everything a crossRef could point at. Unlike
// the numbering plugin in cross-ref.ts, this doesn't gate equations on
// "already referenced" — the picker is how an equation gets referenced for
// the FIRST time, so every block-math node is offered here regardless.
function collectTargets(editor: Editor): CrossRefTarget[] {
  const targets: CrossRefTarget[] = [];
  editor.state.doc.descendants((node) => {
    const id = node.attrs.id as string | undefined;
    if (!id) return true;

    if (node.type.name === "image") {
      const caption = typeof node.attrs.caption === "string" ? node.attrs.caption.trim() : "";
      targets.push({ id, kind: "figure", label: caption });
    } else if (node.type.name === "table") {
      const caption = typeof node.attrs.caption === "string" ? node.attrs.caption.trim() : "";
      targets.push({ id, kind: "table", label: caption });
    } else if (node.type.name === "blockMath") {
      // Prefer the user-given name (set in the math dialog) — raw LaTeX
      // source is unreadable as a list label for anything non-trivial.
      const refName = typeof node.attrs.refName === "string" ? node.attrs.refName.trim() : "";
      const latex = typeof node.attrs.latex === "string" ? node.attrs.latex : "";
      targets.push({ id, kind: "equation", label: refName || latex });
    } else if (node.type.name === "heading") {
      targets.push({ id, kind: "heading", label: node.textContent.trim() });
    }
    return true;
  });
  return targets;
}

type ListHandle = { onKeyDown: (props: { event: KeyboardEvent }) => boolean };

type ListProps = {
  targets: CrossRefTarget[];
  command: (target: CrossRefTarget) => void;
};

const CrossRefList = forwardRef<ListHandle, ListProps>(function CrossRefList(
  { targets, command },
  ref,
) {
  const t = useTranslations("editor.crossRef");
  const [selected, setSelected] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => setSelected(0), [targets]);
  useEffect(() => {
    itemRefs.current[selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelected((i) => (i + targets.length - 1) % targets.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelected((i) => (i + 1) % targets.length);
        return true;
      }
      if (event.key === "Enter") {
        if (targets[selected]) command(targets[selected]);
        return true;
      }
      return false;
    },
  }));

  if (targets.length === 0) {
    return (
      <div className="w-72 rounded-lg border bg-popover p-3 text-sm text-muted-foreground shadow-md">
        {t("empty")}
      </div>
    );
  }

  let flatIndex = -1;

  return (
    <div className="max-h-80 w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
      {KIND_ORDER.map((kind) => {
        const items = targets
          .map((target, originalIndex) => ({ target, originalIndex }))
          .filter(({ target }) => target.kind === kind);
        if (items.length === 0) return null;
        const Icon = KIND_ICON[kind];
        return (
          <div key={kind}>
            <p className="px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground">
              {t(`group${kind.charAt(0).toUpperCase()}${kind.slice(1)}` as never)}
            </p>
            {items.map(({ target }) => {
              flatIndex += 1;
              const index = flatIndex;
              const fallback =
                target.kind === "figure"
                  ? t("untitledFigure")
                  : target.kind === "table"
                    ? t("untitledTable")
                    : target.label;
              return (
                <button
                  key={target.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => command(target)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    index === selected
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate text-foreground">
                    {target.label.trim() || fallback}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
});

// Flips the popup above the caret instead of below when there isn't enough
// room left in the viewport underneath it — triggering "@" near the bottom
// of the window otherwise let the list run past the visible area, hidden
// behind whatever the browser/OS renders at the screen edge (e.g. a
// PWA/mobile browser's own bottom chrome). Needs to measure the popup's
// OWN rendered height, so this can only run after it's actually in the
// DOM, not from the trigger rect alone.
// The list's own Tailwind cap (max-h-80 = 20rem = 320px). The flip decision
// below uses this constant instead of measuring the popup's rendered
// height: positionPopup runs from Suggestion's onStart, BEFORE React has
// painted the freshly-mounted list into the wrapper, so a live
// getBoundingClientRect() height read 0 at exactly that moment — "does it
// fit below" was then always true and the flip never fired, leaving the
// menu pinned under the caret with its lower half past the viewport edge.
const MENU_MAX_HEIGHT = 320;

function positionPopup(popup: HTMLElement | null, rect: DOMRect | null) {
  if (!popup || !rect) return;
  popup.style.left = `${rect.left}px`;
  popup.style.top = "";
  popup.style.bottom = "";
  // maxHeight alone doesn't clip/scroll anything without this — the outer
  // wrapper otherwise just grows past it and the constraint is a no-op.
  popup.style.overflowY = "auto";

  const margin = 12;
  const spaceBelow = window.innerHeight - rect.bottom - 6 - margin;
  const spaceAbove = rect.top - 6 - margin;
  // Flip above as soon as the full-size list can't fit below AND above has
  // more room; if both sides are tight, the larger side loses the least
  // content to the maxHeight cap.
  const placeAbove = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;

  if (placeAbove) {
    popup.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    popup.style.maxHeight = `${Math.min(MENU_MAX_HEIGHT, spaceAbove)}px`;
  } else {
    popup.style.top = `${rect.bottom + 6}px`;
    // Capped to the ACTUAL remaining space — an earlier version floored
    // this at 100px, which near the very bottom of the window exceeded the
    // real space and pushed the menu's lower half off-screen anyway.
    popup.style.maxHeight = `${Math.min(MENU_MAX_HEIGHT, spaceBelow)}px`;
  }
}

function matches(target: CrossRefTarget, query: string): boolean {
  if (!query) return true;
  return target.label.toLowerCase().includes(query.toLowerCase());
}

export const CrossRefSuggestion = Extension.create({
  name: "crossRefSuggestion",
  addProseMirrorPlugins() {
    return [
      Suggestion<CrossRefTarget>({
        editor: this.editor,
        // Suggestion() defaults every instance to the SAME internal plugin
        // key unless one is given explicitly — the existing slash-command
        // menu (slash-command-menu.tsx) also calls Suggestion() without one,
        // so without this, adding both to the same editor crashed with
        // "Adding different instances of a keyed plugin (suggestion$)" the
        // moment the editor mounted.
        pluginKey: new PluginKey("crossRefSuggestion"),
        char: "@",
        startOfLine: false,
        command: ({ editor, range, props }) => {
          insertCrossRef(editor, props.id, range);
        },
        items: ({ editor, query }) =>
          collectTargets(editor as Editor).filter((target) => matches(target, query)),
        render: () => {
          let component: ReactRenderer<ListHandle, ListProps> | null = null;
          let popup: HTMLElement | null = null;

          return {
            onStart: (props) => {
              useCrossRefMenuStore.getState().markOpened();
              component = new ReactRenderer(CrossRefList, {
                props: {
                  targets: props.items,
                  command: (target: CrossRefTarget) => props.command(target),
                },
                editor: props.editor,
              });
              popup = document.createElement("div");
              popup.style.position = "fixed";
              popup.style.zIndex = "50";
              popup.appendChild(component.element);
              document.body.appendChild(popup);
              positionPopup(popup, props.clientRect?.() ?? null);
            },
            onUpdate: (props) => {
              if (!component || !popup) return;
              component.updateProps({
                targets: props.items,
                command: (target: CrossRefTarget) => props.command(target),
              });
              positionPopup(popup, props.clientRect?.() ?? null);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                popup?.remove();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              popup?.remove();
              popup = null;
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
