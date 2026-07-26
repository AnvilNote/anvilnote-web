import type { JSONContent } from "@tiptap/core";
import { AiSnapshotConversionError } from "./ai-snapshot-errors";

// Tiptap JSON <-> AI document v2 mapping for the "core" node/mark family
// (text/marks carriers, paragraph, heading, lists, blockquote, code block,
// math, divider) — see capability-manifest.ts's header comment (in
// anvilnote-ai-writer) for the overall v2 AST picture, and converters.ts's
// own header comment for why this is split into its own file (converters.ts
// would exceed ~500 lines otherwise) and how the chain-of-responsibility
// dispatch across core/structured/visual works.
//
// blockMath naming: the real v2 schema (anvilnote-ai-writer/src/document/v2/
// core-nodes.ts's AiBlockMathNodeV2) names this node "blockMath" — the SAME
// name Tiptap's own @tiptap/extension-mathematics uses. The OLD V1 AST this
// task's sibling code (converters.ts's tiptapDocumentToAnvilNote path)
// targets renames it to "mathBlock"; that renaming is V1-only and must NOT
// be carried over here. Verified directly against the real v2 source above.
//
// Task 24.3 finding: every optional attrs key in the forward ("toSnapshot")
// direction below must be UNCONDITIONALLY present (falling back to `null`/a
// concrete default, never simply omitted) to byte-match
// anvilnote-api/src/modules/ai-conversations/persisted-document-node-mappers.ts's
// own `mapPersistedNodeToV2` — the two independently-written mappers must
// produce identical `canonicalJSONStringify` output for
// `buildEditSnapshot`'s `baseDocumentHash` to agree between this repo (the
// Accept flow's client-side staleness check) and the API (which computed
// `draft.baseDocumentHash` from the persisted document at turn time).
// Confirmed empirically (not just by inspection) by running both mappers
// over the same input document and diffing their sanitized snapshot output
// byte-for-byte: the OLD code here used a truthy/typeof-non-empty check
// (`localRef ? {localRef} : {}`, `refName ? {refName} : {}`, etc.) that
// OMITTED the key whenever the real editor attr held its own default value
// (id/refName null, author/source ""), while the API's mapper always
// forwards the key whenever the source attr is merely `!== undefined` —
// which is virtually always true, since Tiptap's `getJSON()` always
// serializes every node's full declared attrs object, defaults included.
// Every real document containing an un-referenced blockMath (no refName)
// or a table/blockquote with default styling would previously desync the
// two hashes, making the Accept flow's staleness check spuriously fail.
// Confirmed schema-safe: v2's own Zod schemas declare these fields
// `.nullable()`/`.optional()` (verified directly in
// anvilnote-ai-writer/src/document/v2/*.ts), and the API's own mapper
// already emits exactly these null/default values today.
//
// localRef/id round-tripping: heading/blockMath both carry a real, global
// `id` attribute (backfilled by cross-ref.ts's CrossRefTargetIds plugin) —
// the stable id a crossRef's `targetId` points at. AiHeadingNodeV2/
// AiBlockMathNodeV2's own `localRef` attr is documented upstream as an
// "AI-assignable local name", but for LOSSLESS round-tripping of an
// EXISTING document's real crossRef graph (this task's whole point — not
// authoring brand-new AI-assigned refs, which is a later task's
// materializeReferences() concern), the only reversible mapping is a direct
// passthrough: localRef := the real id, verbatim, and back again. This
// keeps every crossRef's targetRef pointing at the exact same target after
// a round trip, with zero information loss.

export function localRefAttr(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function attrsOf(node: JSONContent): Record<string, unknown> {
  return node.attrs ?? {};
}

function paragraphIndentAttrs(value: unknown): { attrs?: { indent: number } } {
  if (value === undefined || value === null || value === 0) return {};
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 8) {
    throw new AiSnapshotConversionError("Paragraph indent must be an integer from 0 to 8.");
  }
  return { attrs: { indent: value } };
}

export interface SnapshotConversionContext {
  block(node: JSONContent): JSONContent;
  inline(node: JSONContent): JSONContent;
}

export interface TiptapConversionContext {
  block(node: JSONContent): JSONContent;
  inline(node: JSONContent): JSONContent;
}

const SIMPLE_MARK_TYPES = new Set(["bold", "italic", "strike", "underline", "code"]);

function optionalString(value: unknown): string | null | undefined {
  return typeof value === "string" ? value : value === null ? null : undefined;
}

// --- Marks --------------------------------------------------------------

export function marksToSnapshot(marks: JSONContent["marks"]): JSONContent["marks"] {
  if (!marks?.length) return undefined;
  return marks.map((mark) => {
    if (SIMPLE_MARK_TYPES.has(mark.type)) return { type: mark.type };
    if (mark.type === "link") {
      const values = mark.attrs ?? {};
      return {
        type: "link",
        attrs: {
          href: String(values.href ?? ""),
          ...(values.title !== undefined ? { title: optionalString(values.title) } : {}),
          ...(values.target !== undefined
            ? { target: optionalString(values.target) as "_blank" | "_self" | null }
            : {}),
        },
      };
    }
    if (mark.type === "textStyle") {
      const values = mark.attrs ?? {};
      return {
        type: "textStyle",
        attrs: { color: typeof values.color === "string" ? values.color : null },
      };
    }
    throw new AiSnapshotConversionError(`Unsupported mark type for Smart Mode: ${mark.type}`);
  });
}

export function marksFromSnapshot(marks: JSONContent["marks"]): JSONContent["marks"] {
  if (!marks?.length) return undefined;
  return marks.map((mark) =>
    mark.type === "link" || mark.type === "textStyle"
      ? { type: mark.type, attrs: { ...mark.attrs } }
      : { type: mark.type },
  );
}

// --- Inline (forward: Tiptap -> v2-shaped JSON) --------------------------

export function coreInlineToSnapshot(
  node: JSONContent,
  _ctx: SnapshotConversionContext,
): JSONContent | undefined {
  switch (node.type) {
    case "text":
      if (!node.text) {
        throw new AiSnapshotConversionError("An empty text node cannot be represented.");
      }
      return {
        type: "text",
        text: node.text,
        ...(node.marks?.length ? { marks: marksToSnapshot(node.marks) } : {}),
      };
    case "hardBreak":
      return { type: "hardBreak" };
    case "inlineMath":
      return { type: "inlineMath", attrs: { latex: String(attrsOf(node).latex ?? "") } };
    default:
      return undefined;
  }
}

// --- Block (forward: Tiptap -> v2-shaped JSON) ---------------------------

export function coreBlockToSnapshot(
  node: JSONContent,
  ctx: SnapshotConversionContext,
): JSONContent | undefined {
  const content = node.content ?? [];
  const values = attrsOf(node);

  switch (node.type) {
    case "paragraph":
      return {
        type: "paragraph",
        ...paragraphIndentAttrs(values.indent),
        content: content.map((child) => ctx.inline(child)),
      };
    case "heading": {
      return {
        type: "heading",
        attrs: {
          level: Number(values.level) as 1 | 2 | 3,
          // Task 24.3 fix: always present (with a `null` fallback), never
          // conditionally omitted — see this file's own updated header
          // comment for why. Applies to every localRef/refName/optional
          // attrs key touched below for the same reason.
          localRef: localRefAttr(values.id) ?? null,
        },
        content: content.map((child) => ctx.inline(child)),
      };
    }
    case "bulletList":
      return { type: "bulletList", content: content.map((child) => ctx.block(child)) };
    case "orderedList":
      return {
        type: "orderedList",
        ...(values.start !== undefined ? { attrs: { start: Number(values.start) } } : {}),
        content: content.map((child) => ctx.block(child)),
      };
    case "listItem":
      return { type: "listItem", content: content.map((child) => ctx.block(child)) };
    case "blockquote": {
      // Present whenever the real attr is defined at all (Tiptap always
      // serializes a declared attr, defaulting author/source to "" when
      // unset) — matches anvilnote-api's own
      // persisted-document-node-mappers.ts mapPersistedNodeToV2 gate
      // exactly (`attrs.author !== undefined`), not a truthy/non-empty
      // check, which previously dropped the key whenever the value was ""
      // and desynced this function's own baseDocumentHash output from the
      // server's (Task 24.3 finding).
      const blockquoteAttrs = {
        ...(values.author !== undefined ? { author: values.author } : {}),
        ...(values.source !== undefined ? { source: values.source } : {}),
      };
      return {
        type: "blockquote",
        ...(Object.keys(blockquoteAttrs).length ? { attrs: blockquoteAttrs } : {}),
        content: content.map((child) => ctx.block(child)),
      };
    }
    case "codeBlock":
      return {
        type: "codeBlock",
        attrs: { language: String(values.language ?? "plaintext") },
        content: content.map((child) => ctx.inline(child)),
      };
    case "blockMath": {
      return {
        type: "blockMath",
        attrs: {
          latex: String(values.latex ?? ""),
          refName: localRefAttr(values.refName) ?? null,
          localRef: localRefAttr(values.id) ?? null,
        },
      };
    }
    case "horizontalRule": {
      const hrAttrs = {
        ...(values.thicknessPt !== undefined ? { thicknessPt: Number(values.thicknessPt) } : {}),
        ...(values.lineStyle !== undefined ? { lineStyle: values.lineStyle } : {}),
      };
      return {
        type: "horizontalRule",
        ...(Object.keys(hrAttrs).length ? { attrs: hrAttrs } : {}),
      };
    }
    default:
      return undefined;
  }
}

// --- Inline (reverse: validated v2-shaped JSON -> Tiptap) ----------------

export function coreInlineFromSnapshot(
  node: JSONContent,
  _ctx: TiptapConversionContext,
): JSONContent | undefined {
  switch (node.type) {
    case "text":
      return {
        type: "text",
        text: String(node.text ?? ""),
        ...(node.marks?.length ? { marks: marksFromSnapshot(node.marks) } : {}),
      };
    case "hardBreak":
      return { type: "hardBreak" };
    case "inlineMath":
      return { type: "inlineMath", attrs: { latex: String(attrsOf(node).latex ?? "") } };
    default:
      return undefined;
  }
}

// --- Block (reverse: validated v2-shaped JSON -> Tiptap) -----------------

export function coreBlockFromSnapshot(
  node: JSONContent,
  ctx: TiptapConversionContext,
): JSONContent | undefined {
  const content = node.content ?? [];
  const values = attrsOf(node);

  switch (node.type) {
    case "paragraph":
      return {
        type: "paragraph",
        ...paragraphIndentAttrs(values.indent),
        content: content.map((child) => ctx.inline(child)),
      };
    case "heading":
      return {
        type: "heading",
        attrs: {
          level: values.level,
          id: typeof values.localRef === "string" ? values.localRef : null,
        },
        content: content.map((child) => ctx.inline(child)),
      };
    case "bulletList":
      return { type: "bulletList", content: content.map((child) => ctx.block(child)) };
    case "orderedList":
      return {
        type: "orderedList",
        attrs: { start: typeof values.start === "number" ? values.start : 1 },
        content: content.map((child) => ctx.block(child)),
      };
    case "listItem":
      return { type: "listItem", content: content.map((child) => ctx.block(child)) };
    case "blockquote":
      return {
        type: "blockquote",
        attrs: {
          author: typeof values.author === "string" ? values.author : "",
          source: typeof values.source === "string" ? values.source : "",
        },
        content: content.map((child) => ctx.block(child)),
      };
    case "codeBlock":
      return {
        type: "codeBlock",
        attrs: { language: String(values.language ?? "plaintext") },
        content: content.map((child) => ctx.inline(child)),
      };
    case "blockMath":
      return {
        type: "blockMath",
        attrs: {
          latex: String(values.latex ?? ""),
          id: typeof values.localRef === "string" ? values.localRef : null,
          // equationNumber is recomputed live by cross-ref.ts's resolver
          // plugin (only referenced equations get numbered) — never
          // reconstructed here.
          equationNumber: null,
          refName: typeof values.refName === "string" ? values.refName : null,
        },
      };
    case "horizontalRule":
      return {
        type: "horizontalRule",
        attrs: {
          thicknessPt: typeof values.thicknessPt === "number" ? values.thicknessPt : 0.5,
          lineStyle: typeof values.lineStyle === "string" ? values.lineStyle : "solid",
        },
      };
    default:
      return undefined;
  }
}
