"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sigma, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { renderMathPreview } from "@/lib/tiptap/math";
import type { MathClickMode } from "@/lib/tiptap/extensions";

export type MathDialogState = {
  open: boolean;
  mode: MathClickMode;
  // null = inserting a new node; a number = editing the node at this position.
  pos: number | null;
  latex: string;
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
  onSave: (latex: string) => void;
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
  onSave: (latex: string) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("editor.math");
  const tBlock = useTranslations("editor.block");
  const [draft, setDraft] = useState(state.latex);

  const isBlock = state.mode === "block";
  const preview = draft.trim() ? renderMathPreview(draft, isBlock) : null;
  // Delete only makes sense for an existing node (state.pos !== null) —
  // matches link-input.tsx's hasLink-conditional Remove button: an action
  // only appears once there's something to remove.
  const isEditing = state.pos !== null;

  function handleSave() {
    onSave(draft);
  }

  return (
      <DialogContent className="sm:max-w-lg">
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

        <div className="space-y-3">
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
            <Textarea
              id="math-source"
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  handleSave();
                }
              }}
              spellCheck={false}
              rows={isBlock ? 4 : 2}
              placeholder={
                isBlock
                  ? "x_U = \\frac{\\hat A^2}{(1+\\hat B)^2}"
                  : "\\alpha + \\beta = \\gamma"
              }
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t("preview")}
            </p>
            <div className="flex min-h-12 items-center justify-center rounded-md border bg-muted/30 px-3 py-2 text-sm">
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
