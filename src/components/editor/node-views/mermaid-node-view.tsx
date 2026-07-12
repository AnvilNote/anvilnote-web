"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import mermaid from "mermaid";
import CodeMirror, { keymap } from "@uiw/react-codemirror";
import { mermaid as mermaidLang } from "codemirror-lang-mermaid";
import { useTheme } from "next-themes";
import { Pencil, Columns2, Eye, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/color-picker";
import {
  MERMAID_THEMES,
  MONOCHROME_THEME_VARIABLES,
  isCustomizableTheme,
  normalizeMermaidTheme,
} from "@/lib/tiptap/mermaid";

type ViewMode = "write" | "preview" | "split";

// React NodeView for Mermaid diagrams. Source is a plain attribute (atom
// node, same shape as blockMath's `latex`), edited via CodeMirror (matches
// math-editor-dialog.tsx's own setup) and rendered client-side via the
// `mermaid` package. Three modes instead of a single edit/preview toggle —
// explicit ask: write-only, preview-only, and split (both visible, preview
// updates live as you type, matching math-editor-dialog.tsx's own side-by-
// side source+preview layout). Resize handle mirrors AnvilImage's own
// pointer-drag-to-percentage-width interaction exactly.
export function MermaidNodeView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const t = useTranslations("editor.mermaid");
  const tBlock = useTranslations("editor.block");
  const { resolvedTheme } = useTheme();
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  // A fresh id per render call, not a single stable one — mermaid.render
  // internally creates (and expects to fully own/clean up) a DOM element
  // keyed by this id; reusing the same id across successive render() calls
  // (e.g. every mode switch re-running the effect) left the preview
  // silently empty (no error, no svg) — confirmed by inspecting the DOM
  // directly after a mode switch to split. Incrementing per call sidesteps
  // whatever internal state mermaid keyed on the old id.
  const renderCounter = useRef(0);
  const frameRef = useRef<HTMLDivElement>(null);

  const source = typeof node.attrs.source === "string" ? node.attrs.source : "";
  const theme = normalizeMermaidTheme(node.attrs.theme);
  const primaryColor =
    typeof node.attrs.primaryColor === "string" ? node.attrs.primaryColor : null;
  const width = typeof node.attrs.width === "number" ? node.attrs.width : null;

  const [mode, setMode] = useState<ViewMode>("preview");
  const [draft, setDraft] = useState(source);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function commitDraft(next: string) {
    setDraft(next);
    if (next !== source) updateAttributes({ source: next });
  }

  // themeVariables only actually take effect under theme "base" — mermaid's
  // other named themes hardcode their own palette and ignore overrides —
  // see isCustomizableTheme's own comment.
  const themeVariables =
    theme === "monochrome"
      ? MONOCHROME_THEME_VARIABLES
      : theme === "base" && primaryColor
        ? { primaryColor }
        : undefined;
  const effectiveTheme = theme === "monochrome" ? "base" : theme;

  useEffect(() => {
    if (mode === "write") return;
    let cancelled = false;
    renderCounter.current += 1;
    const id = `mermaid-${instanceId}-${renderCounter.current}`;
    mermaid.initialize({ startOnLoad: false, theme: effectiveTheme, themeVariables });
    mermaid
      .render(id, draft || " ")
      .then(({ svg: rendered }) => {
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSvg(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
    // themeVariables is a fresh object each render; stringify so the effect
    // only reruns when its actual content changes, not its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, draft, effectiveTheme, JSON.stringify(themeVariables), instanceId]);

  // Numeric twin of the drag handle: type a percentage directly (10–100,
  // blank = natural size) — same percent-of-width sizing convention as
  // stats-chart's own width field.
  function commitWidthPercent(raw: string) {
    if (!raw.trim()) {
      updateAttributes({ width: null });
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    updateAttributes({ width: Math.max(10, Math.min(100, Math.round(value))) });
  }

  function startResize(event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const frame = frameRef.current;
    const containerWidth = editor.view.dom.clientWidth;
    if (!frame || !containerWidth) return;
    const left = frame.getBoundingClientRect().left;

    const onMove = (move: PointerEvent) => {
      const next = ((move.clientX - left) / containerWidth) * 100;
      const clamped = Math.max(10, Math.min(100, Math.round(next)));
      updateAttributes({ width: clamped });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const extensions = useMemo(
    () => [
      mermaidLang(),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => true,
        },
      ]),
    ],
    [],
  );

  const modeButtons: { mode: ViewMode; icon: typeof Pencil; label: string }[] = [
    { mode: "write", icon: Pencil, label: t("modeWrite") },
    { mode: "split", icon: Columns2, label: t("modeSplit") },
    { mode: "preview", icon: Eye, label: t("modePreview") },
  ];

  return (
    <NodeViewWrapper className="anvil-mermaid" data-type="mermaid">
      <div
        ref={frameRef}
        className="anvil-mermaid__frame"
        style={width != null ? { width: `${width}%` } : undefined}
      >
        <div className="anvil-mermaid__toolbar" contentEditable={false}>
          <div className="anvil-mermaid__modes">
            {modeButtons.map(({ mode: m, icon: Icon, label }) => (
              <button
                key={m}
                type="button"
                aria-label={label}
                title={label}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                onMouseDown={(event) => event.stopPropagation()}
                className={
                  "flex size-6 items-center justify-center rounded transition-colors " +
                  (mode === m
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground/60 hover:bg-accent hover:text-foreground")
                }
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>

          <Select
            value={theme}
            onValueChange={(value) => updateAttributes({ theme: normalizeMermaidTheme(value) })}
          >
            <SelectTrigger
              size="sm"
              aria-label={t("selectTheme")}
              onMouseDown={(event) => event.stopPropagation()}
              className="h-6 gap-1 border-0 bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 data-[state=open]:text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MERMAID_THEMES.map((entry) => (
                <SelectItem key={entry} value={entry} className="text-xs">
                  {t(`themes.${entry}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isCustomizableTheme(theme) ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t("customColor")}
                  title={t("customColor")}
                  onMouseDown={(event) => event.stopPropagation()}
                  className="flex size-6 items-center justify-center rounded p-1"
                >
                  <span
                    className="size-full rounded-full border"
                    style={{ backgroundColor: primaryColor ?? "#eca94a" }}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-64 p-3"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <ColorPicker
                  value={primaryColor ?? "#eca94a"}
                  onChange={(rgba) => {
                    const [r, g, b] = rgba as [number, number, number, number];
                    const hex = `#${[r, g, b]
                      .map((c) => Math.round(c).toString(16).padStart(2, "0"))
                      .join("")}`;
                    updateAttributes({ primaryColor: hex });
                  }}
                  className="gap-3"
                >
                  <ColorPickerSelection className="h-32" />
                  <ColorPickerHue />
                  <div className="flex items-center gap-2">
                    <ColorPickerEyeDropper />
                    <ColorPickerOutput />
                  </div>
                  <ColorPickerFormat />
                </ColorPicker>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>

        <div className={mode === "split" ? "anvil-mermaid__split" : undefined}>
          {mode !== "preview" ? (
            <div className="anvil-mermaid__source" onMouseDown={(event) => event.stopPropagation()}>
              <CodeMirror
                value={draft}
                onChange={commitDraft}
                extensions={extensions}
                theme={resolvedTheme === "dark" ? "dark" : "light"}
                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
              />
            </div>
          ) : null}

          {mode !== "write" ? (
            error ? (
              <div className="anvil-mermaid__error">
                {t("renderError")}: {error}
              </div>
            ) : (
              <div
                className="anvil-mermaid__preview"
                dangerouslySetInnerHTML={{ __html: svg ?? "" }}
              />
            )
          ) : null}
        </div>

        <div className="anvil-mermaid__actions" contentEditable={false}>
          <button
            type="button"
            aria-label={tBlock("delete", { type: tBlock("types.mermaid") })}
            title={tBlock("delete", { type: tBlock("types.mermaid") })}
            onClick={deleteNode}
            onMouseDown={(event) => event.stopPropagation()}
            className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        <div className="anvil-mermaid__handle" onPointerDown={startResize} contentEditable={false} />

        <div
          className="anvil-size-percent"
          contentEditable={false}
          title={tBlock("widthPercent")}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <input
            type="number"
            min={10}
            max={100}
            placeholder="100"
            aria-label={tBlock("widthPercent")}
            value={width ?? ""}
            onChange={(event) => commitWidthPercent(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
          %
        </div>
      </div>
    </NodeViewWrapper>
  );
}
