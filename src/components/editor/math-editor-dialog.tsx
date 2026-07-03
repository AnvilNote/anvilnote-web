"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Sigma, Trash2 } from "lucide-react";
import CodeMirror, { keymap } from "@uiw/react-codemirror";
import { latex } from "codemirror-lang-latex";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renderMathPreview } from "@/lib/tiptap/math";
import type { MathClickMode } from "@/lib/tiptap/extensions";

export type MathDialogState = {
  open: boolean;
  mode: MathClickMode;
  // null = inserting a new node; a number = editing the node at this position.
  pos: number | null;
  latex: string;
  // Optional display name for cross-references (block math only) — the @
  // suggestion list shows this instead of raw LaTeX when set.
  refName?: string;
};

export const CLOSED_MATH_DIALOG: MathDialogState = {
  open: false,
  mode: "inline",
  pos: null,
  latex: "",
};

export function MathEditorDialog({
  state,
  onOpenChange,
  onSave,
  onDelete,
}: {
  state: MathDialogState;
  onOpenChange: (open: boolean) => void;
  onSave: (latex: string, refName?: string) => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      {/* Keyed so the form remounts (and re-seeds its draft) for each session,
          without a setState-in-effect. */}
      {state.open ? (
        <MathDialogForm
          key={`${state.mode}-${state.pos ?? "new"}`}
          state={state}
          onCancel={() => onOpenChange(false)}
          onSave={onSave}
          onDelete={onDelete}
        />
      ) : null}
    </Dialog>
  );
}

function MathDialogForm({
  state,
  onCancel,
  onSave,
  onDelete,
}: {
  state: MathDialogState;
  onCancel: () => void;
  onSave: (latex: string, refName?: string) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("editor.math");
  const tBlock = useTranslations("editor.block");
  const { resolvedTheme } = useTheme();
  const [draft, setDraft] = useState(state.latex);
  const [nameDraft, setNameDraft] = useState(state.refName ?? "");

  const isBlock = state.mode === "block";
  const preview = draft.trim() ? renderMathPreview(draft, isBlock) : null;
  // Delete only makes sense for an existing node (state.pos !== null) —
  // matches link-input.tsx's hasLink-conditional Remove button: an action
  // only appears once there's something to remove.
  const isEditing = state.pos !== null;

  function handleSave() {
    onSave(draft, isBlock ? nameDraft : undefined);
  }

  // codemirror-lang-latex is built from Overleaf's own LaTeX grammar —
  // gives real syntax highlighting, bracket matching, and (via
  // @uiw/react-codemirror's default indentWithTab) Tab-to-indent instead of
  // Tab moving focus away, plus indentOnInput auto-continuing the current
  // line's indentation on Enter — the concrete asks behind "make this look
  // like a code editor" and "support indentation, mainly for environments".
  // Linting (missing \documentclass, unresolved \ref, etc.) is disabled: a
  // short standalone formula isn't a full LaTeX document, and those checks
  // would just produce constant false-positive warnings here.
  //
  // Rebuilt on every `draft` change (so the Mod-Enter keymap always saves
  // the latest text, not a stale closure) rather than memoized once — this
  // is safe and cheap: @uiw/react-codemirror applies a changed extensions
  // array via CodeMirror's own Compartment.reconfigure, which swaps
  // behavior in place without resetting the document or undo history.
  const extensions = useMemo(
    () => [
      latex({ enableLinting: false, autoCloseBrackets: true, autoCloseTags: true }),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            handleSave();
            return true;
          },
        },
      ]),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, nameDraft],
  );

  return (
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sigma className="size-4" />
            {state.pos !== null
              ? t("editTitle")
              : isBlock
                ? t("insertBlockTitle")
                : t("insertInlineTitle")}
          </DialogTitle>
          <DialogDescription>
            {isBlock ? t("displayHint") : t("inlineHint")}
          </DialogDescription>
        </DialogHeader>

        {/* Side-by-side on wider screens: type on the left, see the
            rendered result on the right without scrolling down to check
            it. Stacks back to top/bottom on narrow viewports, same as
            before, since there isn't room for two columns there. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="math-source"
                className="text-xs font-medium text-muted-foreground"
              >
                {t("source")}
              </label>
              <a
                href="https://katex.org/docs/supported.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {t("supportedSyntax")}
              </a>
            </div>
            <div
              id="math-source"
              className="overflow-hidden rounded-md border text-sm [&_.cm-editor]:rounded-md [&_.cm-scroller]:font-mono"
            >
              <CodeMirror
                autoFocus
                value={draft}
                onChange={setDraft}
                extensions={extensions}
                theme={resolvedTheme === "dark" ? "dark" : "light"}
                // A fixed height, not minHeight/maxHeight — with a growable
                // box, the horizontal scrollbar (for a long unwrapped LaTeX
                // line) sits directly under however many lines happen to be
                // visible, so it drifts up and down as content grows. A
                // fixed-height box makes CodeMirror scroll internally
                // instead, so the scrollbar stays pinned to the box's
                // actual bottom edge regardless of content.
                height="220px"
                basicSetup={{
                  lineNumbers: isBlock,
                  foldGutter: false,
                  highlightActiveLine: false,
                }}
                placeholder={
                  isBlock
                    ? "x_U = \\frac{\\hat A^2}{(1+\\hat B)^2}"
                    : "\\alpha + \\beta = \\gamma"
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t("preview")}
            </p>
            {/* Fixed 220px, matching CodeMirror's own fixed height above —
                same reasoning: a height that grows/shrinks with the
                rendered formula's size would make the two boxes drift out
                of alignment as the user types. Overflow (a display formula
                taller than the box) scrolls internally instead. */}
            <div className="flex h-[220px] items-center justify-center overflow-auto rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {!preview ? (
                <span className="text-muted-foreground">{t("emptyPreview")}</span>
              ) : preview.ok ? (
                <span dangerouslySetInnerHTML={{ __html: preview.html }} />
              ) : (
                <span className="text-destructive">{t("invalid")}</span>
              )}
            </div>
          </div>
        </div>

        {isBlock ? (
          <div className="space-y-1.5">
            <label
              htmlFor="math-ref-name"
              className="text-xs font-medium text-muted-foreground"
            >
              {t("refName")}
            </label>
            <Input
              id="math-ref-name"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder={t("refNamePlaceholder")}
            />
          </div>
        ) : null}

        <DialogFooter>
          {isEditing ? (
            <Button
              variant="ghost"
              onClick={onDelete}
              className="text-destructive hover:text-destructive sm:mr-auto"
            >
              <Trash2 className="size-4" />
              {tBlock("delete", { type: tBlock(`types.${isBlock ? "blockMath" : "inlineMath"}`) })}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!draft.trim()}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
  );
}
