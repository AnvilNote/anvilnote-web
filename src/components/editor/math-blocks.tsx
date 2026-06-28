"use client";

import "katex/dist/katex.min.css";

import { useState } from "react";
import katex from "katex";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from "@blocknote/core";
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
} from "@blocknote/react";

// Math is authored in LaTeX. KaTeX renders it in the editor; at export time the
// renderer converts the same LaTeX to Typst (tex2typst). The stored shape —
// { type: "math" | "inlineMath", props: { formula } } — is the contract the
// renderer reads.

function renderKatex(formula: string, displayMode: boolean): string {
  try {
    return katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return "";
  }
}

function KatexView({ formula, display }: { formula: string; display: boolean }) {
  const html = renderKatex(formula, display);
  if (!formula.trim()) {
    return (
      <span className="text-muted-foreground italic">
        {display ? "點擊輸入公式 (LaTeX)" : "公式"}
      </span>
    );
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// --- Block-level (display) equation ---------------------------------------

export const mathBlock = createReactBlockSpec(
  {
    type: "math",
    propSchema: { formula: { default: "" } },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const formula = (block.props as { formula: string }).formula;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [editing, setEditing] = useState(false);
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [draft, setDraft] = useState(formula);

      const commit = () => {
        setEditing(false);
        if (draft !== formula) {
          editor.updateBlock(block, { props: { formula: draft } });
        }
      };

      return (
        <div className="my-2 w-full" contentEditable={false}>
          {editing ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") {
                  setDraft(formula);
                  setEditing(false);
                }
              }}
              spellCheck={false}
              className="w-full resize-y rounded-md border bg-muted/30 p-2 font-mono text-sm outline-none"
              rows={Math.min(6, Math.max(1, draft.split("\n").length))}
              placeholder="輸入 LaTeX，例如 \\frac{dP}{dt} = k(a+c) - k(b+d)P"
            />
          ) : (
            <div
              className="flex cursor-text justify-center rounded-md px-2 py-1 hover:bg-accent/30"
              onClick={() => {
                setDraft(formula);
                setEditing(true);
              }}
            >
              <KatexView formula={formula} display />
            </div>
          )}
        </div>
      );
    },
  },
)();

// --- Inline equation -------------------------------------------------------

export const inlineMath = createReactInlineContentSpec(
  {
    type: "inlineMath",
    propSchema: { formula: { default: "" } },
    content: "none",
  },
  {
    render: ({ inlineContent, updateInlineContent }) => {
      const formula = (inlineContent.props as { formula: string }).formula;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [editing, setEditing] = useState(false);
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [draft, setDraft] = useState(formula);

      const commit = () => {
        setEditing(false);
        updateInlineContent({ type: "inlineMath", props: { formula: draft } });
      };

      if (editing) {
        return (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft(formula);
                setEditing(false);
              }
            }}
            spellCheck={false}
            size={Math.max(6, draft.length)}
            className="rounded border bg-muted/30 px-1 font-mono text-sm outline-none"
          />
        );
      }

      return (
        <span
          className="cursor-text rounded px-0.5 hover:bg-accent/30"
          contentEditable={false}
          onClick={() => {
            setDraft(formula);
            setEditing(true);
          }}
        >
          <KatexView formula={formula} display={false} />
        </span>
      );
    },
  },
);

// Schema = default blocks/inline content + our math types.
export const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, math: mathBlock },
  inlineContentSpecs: { ...defaultInlineContentSpecs, inlineMath },
});

export type AnvilSchema = typeof schema;
