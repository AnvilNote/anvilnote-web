"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ComponentType,
} from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { cn } from "@/lib/utils";

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

    useEffect(() => setSelected(0), [items]);

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

function positionPopup(popup: HTMLElement | null, rect: DOMRect | null) {
  if (!popup || !rect) return;
  popup.style.left = `${rect.left}px`;
  // Drop the menu just below the caret; the list is height-capped so it stays
  // on screen for typical positions.
  popup.style.top = `${rect.bottom + 6}px`;
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
