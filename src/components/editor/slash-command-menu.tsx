"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { useSlashMenuStore } from "@/lib/stores/slash-menu-store";

export type SlashItem = {
  title: string;
  subtitle?: string;
  icon: ComponentType<{ className?: string }>;
  aliases?: string[];
  run: (props: { editor: Editor; range: Range }) => void;
};

type SlashListHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

type SlashListProps = {
  items: SlashItem[];
  command: (item: SlashItem) => void;
};

// The popup list. Keyboard navigable: ↑/↓ move, Enter selects. The suggestion
// plugin forwards key events here via the imperative handle.
const SlashList = forwardRef<SlashListHandle, SlashListProps>(
  function SlashList({ items, command }, ref) {
    const [selected, setSelected] = useState(0);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => setSelected(0), [items]);

    // Arrow keys move `selected` without any pointer movement, so unlike
    // hover the browser never scrolls the item into view on its own.
    useEffect(() => {
      itemRefs.current[selected]?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelected((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          if (items[selected]) command(items[selected]);
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
          return (
            <button
              key={item.title}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              onMouseEnter={() => setSelected(index)}
              onClick={() => command(item)}
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
            props.run({ editor, range });
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
