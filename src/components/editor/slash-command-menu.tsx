"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { createPortal } from "react-dom";
import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSlashMenuStore } from "@/lib/stores/slash-menu-store";

export type SlashItem = {
  featureId?: string;
  title: string;
  subtitle?: string;
  icon: ComponentType<{ className?: string }>;
  aliases?: string[];
  // Items with sub-options (e.g. "question block" → 單選/多選/手寫) skip
  // `run` entirely and list their choices here instead — selecting the
  // parent opens a flyout to the right rather than inserting anything
  // itself. See SubMenu below.
  children?: SlashItem[];
  run?: (props: { editor: Editor; range: Range }) => void;
};

type SlashListHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

type SlashListProps = {
  items: SlashItem[];
  command: (item: SlashItem) => void;
};

const SUBMENU_WIDTH = 208; // matches the panel's own w-52

// Flyout for a parent item's `children`, portaled to <body> (not nested
// inside the scrollable list) — the list's own overflow-y-auto implicitly
// clips overflow-x too (a well-known CSS quirk: one axis "auto" and the
// other "visible" collapses both to clipped), so a submenu positioned
// inside that container would get cut off at the list's right edge.
// Positioning itself is computed from the anchor row's own rect, same
// approach as positionPopup below for the top-level menu.
function SubMenu({
  anchorEl,
  items,
  selected,
  onHover,
  onSelect,
}: {
  anchorEl: HTMLElement | null;
  items: SlashItem[];
  selected: number;
  onHover: (index: number) => void;
  onSelect: (item: SlashItem) => void;
}) {
  const [style, setStyle] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const overflowsRight = rect.right + 4 + SUBMENU_WIDTH > window.innerWidth;
    setStyle({
      left: overflowsRight ? rect.left - 4 - SUBMENU_WIDTH : rect.right + 4,
      top: rect.top,
    });
  }, [anchorEl]);

  if (!style) return null;

  return createPortal(
    <div
      className="fixed z-50 w-52 rounded-lg border bg-popover p-1 shadow-md"
      style={{ left: style.left, top: style.top }}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            type="button"
            data-feature-id={item.featureId}
            onMouseEnter={() => onHover(index)}
            onClick={() => onSelect(item)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              index === selected
                ? "bg-accent text-foreground"
                : "text-muted-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex flex-col">
              <span className="text-foreground">{item.title}</span>
              {item.subtitle ? (
                <span className="text-xs text-muted-foreground">
                  {item.subtitle}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

// The popup list. Keyboard navigable: ↑/↓ move, Enter selects. The suggestion
// plugin forwards key events here via the imperative handle.
export const SlashList = forwardRef<SlashListHandle, SlashListProps>(
  function SlashList({ items, command }, ref) {
    const [selected, setSelected] = useState(0);
    // expanded: index of the top-level item whose submenu flyout is shown
    // (hover always shows it; keyboard only opens it via →/Enter).
    // submenuActive: whether ↑/↓/Enter currently navigate the flyout
    // instead of the top-level list — lets hovering a parent preview its
    // children without hijacking keyboard nav until the user explicitly
    // commits to it.
    const [expanded, setExpanded] = useState<number | null>(null);
    const [subSelected, setSubSelected] = useState(0);
    const [submenuActive, setSubmenuActive] = useState(false);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => {
      setSelected(0);
      setExpanded(null);
      setSubmenuActive(false);
    }, [items]);

    // Arrow keys move `selected` without any pointer movement, so unlike
    // hover the browser never scrolls the item into view on its own.
    useEffect(() => {
      itemRefs.current[selected]?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        const current = items[selected];
        const children = current?.children;

        if (submenuActive && children?.length) {
          if (event.key === "ArrowUp") {
            setSubSelected((i) => (i + children.length - 1) % children.length);
            return true;
          }
          if (event.key === "ArrowDown") {
            setSubSelected((i) => (i + 1) % children.length);
            return true;
          }
          if (event.key === "ArrowLeft") {
            setSubmenuActive(false);
            return true;
          }
          if (event.key === "Enter") {
            const child = children[subSelected];
            if (child) command(child);
            return true;
          }
          return false;
        }

        if (event.key === "ArrowUp") {
          setSelected((i) => (i + items.length - 1) % items.length);
          setSubmenuActive(false);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((i) => (i + 1) % items.length);
          setSubmenuActive(false);
          return true;
        }
        if (event.key === "ArrowRight" && children?.length) {
          setExpanded(selected);
          setSubSelected(0);
          setSubmenuActive(true);
          return true;
        }
        if (event.key === "Enter") {
          if (children?.length) {
            setExpanded(selected);
            setSubSelected(0);
            setSubmenuActive(true);
            return true;
          }
          if (current) command(current);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="max-h-72 w-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
        {items.map((item, index) => {
          const Icon = item.icon;
          const hasChildren = !!item.children?.length;
          return (
            <button
              key={item.title}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              data-feature-id={item.featureId}
              onMouseEnter={() => {
                setSelected(index);
                setExpanded(hasChildren ? index : null);
                setSubmenuActive(false);
              }}
              onClick={() => {
                if (hasChildren) {
                  setSelected(index);
                  setExpanded(index);
                  setSubSelected(0);
                  setSubmenuActive(false);
                  return;
                }
                command(item);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                index === selected
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex flex-col">
                <span className="text-foreground">{item.title}</span>
                {item.subtitle ? (
                  <span className="text-xs text-muted-foreground">
                    {item.subtitle}
                  </span>
                ) : null}
              </span>
              {hasChildren ? (
                <ChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground/60" />
              ) : null}
            </button>
          );
        })}
        {expanded !== null && items[expanded]?.children?.length ? (
          <SubMenu
            anchorEl={itemRefs.current[expanded]}
            items={items[expanded].children!}
            selected={subSelected}
            onHover={setSubSelected}
            onSelect={(child) => command(child)}
          />
        ) : null}
      </div>
    );
  },
);

// Flips the menu above the caret instead of below when there isn't enough
// room left underneath it in the viewport — triggering "/" near the bottom
// of the window otherwise let the list run past the visible area, hidden
// behind whatever the browser/OS renders at the screen edge. Needs the
// popup's own rendered height, so this only works once it's already in the
// DOM (called from onStart/onUpdate, after ReactRenderer has mounted it).
// The list's own Tailwind cap (max-h-72 = 18rem = 288px). The flip decision
// below uses this constant instead of measuring the popup's rendered
// height: positionPopup runs from Suggestion's onStart, BEFORE React has
// painted the freshly-mounted list into the wrapper, so a live
// getBoundingClientRect() height read 0 at exactly that moment — "does it
// fit below" was then always true and the flip never fired, leaving the
// menu pinned under the caret with its lower half past the viewport edge.
const MENU_MAX_HEIGHT = 288;

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

// Builds the slash-command extension. `items` is provided by the editor so the
// labels are localized and math entries can open the math dialog.
export function createSlashCommand(getItems: () => SlashItem[]) {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem>({
          editor: this.editor,
          char: "/",
          startOfLine: false,
          command: ({ editor, range, props }) => {
            props.run?.({ editor, range });
          },
          items: ({ query }) => {
            const q = query.trim().toLowerCase();
            // Rank by match quality so short aliases land first: exact (e.g.
            // "/x" → inline math) > prefix > substring. Empty query lists all.
            return getItems()
              .map((item) => {
                const terms = [item.title, ...(item.aliases ?? [])].map((s) =>
                  s.toLowerCase(),
                );
                let score = 0;
                if (q === "") score = 1;
                else if (terms.some((term) => term === q)) score = 3;
                else if (terms.some((term) => term.startsWith(q))) score = 2;
                else if (terms.some((term) => term.includes(q))) score = 1;
                return { item, score };
              })
              .filter((entry) => entry.score > 0)
              .sort((a, b) => b.score - a.score)
              .map((entry) => entry.item);
          },
          render: () => {
            let component: ReactRenderer<SlashListHandle, SlashListProps> | null =
              null;
            let popup: HTMLElement | null = null;

            return {
              onStart: (props) => {
                useSlashMenuStore.getState().markOpened();
                component = new ReactRenderer(SlashList, {
                  props: {
                    items: props.items,
                    command: (item: SlashItem) => props.command(item),
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
                  items: props.items,
                  command: (item: SlashItem) => props.command(item),
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
}
