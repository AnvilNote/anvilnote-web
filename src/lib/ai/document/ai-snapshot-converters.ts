import type { JSONContent } from "@tiptap/core";
import { parseDocumentV2 } from "@anvilnote/ai-writer/document";
import type { AiSnapshotDocumentV1, EditSnapshotSourceV1 } from "@anvilnote/ai-writer";
import { AiSnapshotConversionError, assertNever } from "./ai-snapshot-errors";
import {
  coreBlockFromSnapshot,
  coreBlockToSnapshot,
  coreInlineFromSnapshot,
  coreInlineToSnapshot,
  type SnapshotConversionContext,
  type TiptapConversionContext,
} from "./core-node-converters";
import { structuredNodeFromSnapshot, structuredNodeToSnapshot } from "./structured-node-converters";
import { visualBlockFromSnapshot, visualBlockToSnapshot } from "./visual-node-converters";
import { resolveProtectedImage, type ProtectedImageRegistry } from "./protected-image-registry";

// V2 canonical AST conversion (Task 24.1) — full-structure Smart Mode edit
// snapshots against @anvilnote/ai-writer/document's canonical, 32-node-type
// AiDocumentV2/parseDocumentV2, with REAL image protection (an opaque
// `{type:"protectedImage", ref}` node placeholder from ai-writer's own
// buildEditSnapshot/EditSnapshotV1 — NOT converters.ts's OLD text-placeholder
// trick, `ProtectedSelectionRegistry`).
//
// This is a brand-new, independent module — converters.ts's OLD V1 path
// (tiptapDocumentToAnvilNote/anvilNoteDocumentToTiptap/
// tiptapSelectionToAnvilNote/anvilNoteFragmentToTiptap, BLOCKED_NODES/
// PROTECTED_NODES, UnsupportedAIContentError) stays completely UNCHANGED in
// converters.ts and is still the live implementation behind the OLD
// compose/rewrite-selection UI flow (smart-mode-panel.tsx/
// tiptap-bubble-menu.tsx, confirmed by grep before writing this comment).
// converters.ts re-exports this module's two public functions so callers
// can still `import { tiptapDocumentToAiSnapshotSource } from "./converters"`
// per this task's own interface list, while the actual implementation lives
// here (kept out of converters.ts, which would otherwise exceed ~500 lines
// combining the OLD V1 code with this).
//
// Dispatch is a chain of responsibility across three per-node-family
// modules (core-node-converters.ts/structured-node-converters.ts/
// visual-node-converters.ts): each family's `xToSnapshot`/`xFromSnapshot`
// function returns `undefined` for any node type it doesn't own, and the
// dispatchers below try each family in turn, ending in a runtime "unknown
// node type" throw (via assertNever — a real compile-time exhaustiveness
// check only applies to the REVERSE direction's per-family switches, which
// operate over a validated, genuinely-discriminated AiBlockNodeV2/
// AiInlineNodeV2 union; the FORWARD direction's input is raw, loosely-typed
// Tiptap JSON with no such union to exhaust against, so it gets the same
// runtime fail-closed default case the OLD V1 code in converters.ts already
// uses).
//
// image/imageRow are handled directly here (untouched passthrough) since
// they belong to none of the three V2 node families — they never enter the
// V2 payload at all. This module's OWN job is the other 32 node types'
// mapping; buildEditSnapshot (ai-writer, called by this module's own
// callers/tests, not from inside this module) sanitizes image/imageRow into
// opaque protectedImage placeholders one level below.
const PROTECTED_IMAGE_NODE_TYPES = new Set(["image", "imageRow"]);

function blockToSnapshotNode(node: JSONContent): JSONContent {
  if (PROTECTED_IMAGE_NODE_TYPES.has(node.type ?? "")) {
    return structuredClone(node);
  }
  const ctx: SnapshotConversionContext = { block: blockToSnapshotNode, inline: inlineToSnapshotNode };
  const result =
    coreBlockToSnapshot(node, ctx) ??
    structuredNodeToSnapshot(node, ctx) ??
    visualBlockToSnapshot(node, ctx);
  return result ?? assertNever(node as never, `Unknown block node type "${node.type ?? "unknown"}"`);
}

function inlineToSnapshotNode(node: JSONContent): JSONContent {
  const ctx: SnapshotConversionContext = { block: blockToSnapshotNode, inline: inlineToSnapshotNode };
  const result = coreInlineToSnapshot(node, ctx) ?? structuredNodeToSnapshot(node, ctx);
  return result ?? assertNever(node as never, `Unknown inline node type "${node.type ?? "unknown"}"`);
}

function snapshotNodeToTiptapBlock(
  node: JSONContent,
  protectedImages: ProtectedImageRegistry,
): JSONContent {
  if (node.type === "protectedImage") {
    const ref = (node as unknown as { ref?: unknown }).ref;
    if (typeof ref !== "string" || ref.length === 0) {
      throw new AiSnapshotConversionError("A protectedImage placeholder is missing its ref.");
    }
    return structuredClone(resolveProtectedImage(protectedImages, ref));
  }
  const ctx: TiptapConversionContext = {
    block: (child) => snapshotNodeToTiptapBlock(child, protectedImages),
    inline: (child) => snapshotNodeToTiptapInline(child, protectedImages),
  };
  const result =
    coreBlockFromSnapshot(node, ctx) ??
    structuredNodeFromSnapshot(node, ctx) ??
    visualBlockFromSnapshot(node, ctx);
  return result ?? assertNever(node as never, `Unknown block node type "${node.type ?? "unknown"}"`);
}

function snapshotNodeToTiptapInline(
  node: JSONContent,
  protectedImages: ProtectedImageRegistry,
): JSONContent {
  const ctx: TiptapConversionContext = {
    block: (child) => snapshotNodeToTiptapBlock(child, protectedImages),
    inline: (child) => snapshotNodeToTiptapInline(child, protectedImages),
  };
  const result = coreInlineFromSnapshot(node, ctx) ?? structuredNodeFromSnapshot(node, ctx);
  return result ?? assertNever(node as never, `Unknown inline node type "${node.type ?? "unknown"}"`);
}

// Validation: parseDocumentV2 can't run directly against a tree that still
// contains real "image"/"imageRow" nodes (forward direction) or
// "protectedImage" placeholders (reverse direction) — neither is a member
// of AiBlockNodeV2's Zod union, so parsing would fail immediately on THEM
// regardless of whether the rest of the tree is perfectly valid V2 shape.
// This module's own final-validation step therefore runs against a
// "validation tree": the same converted structure with every image-shaped
// node substituted for a semantically-inert `{type:"horizontalRule"}`
// stand-in — a real, attrs-optional, content-free AiBlockNodeV2 member that
// can legally occupy any position a real image/protectedImage can (images
// are `group:"block"` only in the real editor; the one narrower slot,
// choiceItem's own `[paragraph|blockMath]` tuple, rejects a horizontalRule
// stand-in exactly as it would reject a real image, so this substitution
// doesn't silently hide a genuinely-misplaced image). Every OTHER
// structural/semantic rule parseDocumentV2 enforces — table geometry,
// question hierarchy, duplicate/unresolved localRef and targetRef
// resolution, unknown mark shapes the per-family mappers didn't already
// reject — still runs for real against every non-image node. This mirrors
// converters.ts's OLD V1 code's own final
// `AnvilNoteDocumentV1Schema.parse(...)` /
// `AnvilNoteDocumentFragmentV1Schema.parse(...)` backstop, adapted for the
// fact V2 documents can legitimately contain images V1 simply never allowed
// through at all.
function toValidationNode(node: JSONContent): JSONContent {
  if (PROTECTED_IMAGE_NODE_TYPES.has(node.type ?? "") || node.type === "protectedImage") {
    return { type: "horizontalRule" };
  }
  if (!node.content) return node;
  return { ...node, content: node.content.map(toValidationNode) };
}

function assertValidAiDocumentV2Shape(content: JSONContent[], context: string): void {
  try {
    parseDocumentV2({ version: 2, type: "doc", content });
  } catch (error) {
    throw new AiSnapshotConversionError(
      `${context}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

// Produces a RawEditorDocumentV1-shaped tree (real Tiptap JSON, images still
// included verbatim) suitable as `buildEditSnapshot`'s own input — the
// caller (this module's tests today; Task 24.2/24.3's runtime-client.ts
// later, NOT this function) is responsible for calling
// `buildEditSnapshot(source)` separately to get the image-sanitized
// EditSnapshotV1 the AI provider actually sees.
export function tiptapDocumentToAiSnapshotSource(document: JSONContent): EditSnapshotSourceV1 {
  if (document.type !== "doc") {
    throw new AiSnapshotConversionError(
      `Expected a Tiptap "doc" node, got "${document.type ?? "unknown"}".`,
    );
  }
  const content = (document.content ?? []).map((node) => blockToSnapshotNode(node));
  assertValidAiDocumentV2Shape(content.map(toValidationNode), "tiptapDocumentToAiSnapshotSource");
  return { document: { type: "doc", content } } as unknown as EditSnapshotSourceV1;
}

// Restores an (AI-produced or round-tripped) sanitized V2 snapshot document
// back into real Tiptap JSON, splicing real image/imageRow subtrees back in
// by ref via `protectedImages` (built from `EditSnapshotV1.protectedImages`
// — see protected-image-registry.ts's `createProtectedImageRegistry`).
export function aiSnapshotCandidateToTiptap(
  document: AiSnapshotDocumentV1,
  protectedImages: ProtectedImageRegistry,
): JSONContent {
  const content = document.content as unknown as JSONContent[];
  assertValidAiDocumentV2Shape(content.map(toValidationNode), "aiSnapshotCandidateToTiptap");
  return {
    type: "doc",
    content: content.map((node) => snapshotNodeToTiptapBlock(node, protectedImages)),
  };
}
