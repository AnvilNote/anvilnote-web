"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Extension, type Editor } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { insertQuestionBlank } from "@/lib/tiptap/question-blank";

type QuestionTarget = { id: string; number: string; label: string };

// Walks the doc for every questionItem — unlike cross-ref-suggestion.tsx's
// collectTargets, there's only one kind here, so no per-kind grouping.
// `label` is the question body's own text (first line), truncated in the
// list UI via CSS, not here — same "show the real content, let the list
// item itself truncate" approach cross-ref-suggestion.tsx uses for
// figure/table captions.
function collectTargets(editor: Editor): QuestionTarget[] {
  const targets: QuestionTarget[] = [];
  let questionN = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "questionItem") return true;
    questionN += 1;
    const id = node.attrs.id as string | undefined;
    if (id) targets.push({ id, number: String(questionN), label: node.textContent.trim() });
    return true;
  });
  return targets;
}

type ListHandle = { onKeyDown: (props: { event: KeyboardEvent }) => boolean };
type ListProps = { targets: QuestionTarget[]; command: (target: QuestionTarget) => void };

const QuestionBlankList = forwardRef<ListHandle, ListProps>(function QuestionBlankList(
  { targets, command },
  ref,
) {
  const t = useTranslations("editor.questionBlank");
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
        {t("pickerEmpty")}
      </div>
    );
  }

  return (
    <div className="max-h-80 w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
      {targets.map((target, index) => (
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
            index === selected ? "bg-accent text-foreground" : "text-muted-foreground",
          )}
        >
          <span className="shrink-0 font-medium text-foreground">{target.number}.</span>
          <span className="truncate text-foreground">
            {target.label || t("pickerUntitled", { number: target.number })}
          </span>
        </button>
      ))}
    </div>
  );
});

const MENU_MAX_HEIGHT = 320;

function positionPopup(popup: HTMLElement | null, rect: DOMRect | null) {
  if (!popup || !rect) return;
  popup.style.left = `${rect.left}px`;
  popup.style.top = "";
  popup.style.bottom = "";
  popup.style.overflowY = "auto";

  const margin = 12;
  const spaceBelow = window.innerHeight - rect.bottom - 6 - margin;
  const spaceAbove = rect.top - 6 - margin;
  const placeAbove = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;

  if (placeAbove) {
    popup.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    popup.style.maxHeight = `${Math.min(MENU_MAX_HEIGHT, spaceAbove)}px`;
  } else {
    popup.style.top = `${rect.bottom + 6}px`;
    popup.style.maxHeight = `${Math.min(MENU_MAX_HEIGHT, spaceBelow)}px`;
  }
}

function matches(target: QuestionTarget, query: string): boolean {
  if (!query) return true;
  return (
    target.label.toLowerCase().includes(query.toLowerCase()) || target.number.startsWith(query)
  );
}

export const QuestionBlankSuggestion = Extension.create({
  name: "questionBlankSuggestion",
  addProseMirrorPlugins() {
    return [
      Suggestion<QuestionTarget>({
        editor: this.editor,
        pluginKey: new PluginKey("questionBlankSuggestion"),
        char: "#",
        startOfLine: false,
        command: ({ editor, range, props }) => {
          insertQuestionBlank(editor, props.id, range);
        },
        items: ({ editor, query }) =>
          collectTargets(editor as Editor).filter((target) => matches(target, query)),
        render: () => {
          let component: ReactRenderer<ListHandle, ListProps> | null = null;
          let popup: HTMLElement | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(QuestionBlankList, {
                props: {
                  targets: props.items,
                  command: (target: QuestionTarget) => props.command(target),
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
                command: (target: QuestionTarget) => props.command(target),
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
