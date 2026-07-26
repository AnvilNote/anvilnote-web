import type { JSONContent } from "@tiptap/core";
import type { AiEditOperationV1 } from "@anvilnote/ai-writer";
import { buildEditSnapshot, type AiSnapshotDocumentV1, type EditSnapshotV1 } from "@anvilnote/ai-writer";
import { tiptapDocumentToAiSnapshotSource } from "./ai-snapshot-converters";
import {
  createProtectedImageRegistry,
  resolveProtectedImage,
  type ProtectedImageRegistry,
} from "./protected-image-registry";
import { AiSnapshotConversionError } from "./ai-snapshot-errors";
import { coreBlockFromSnapshot, coreInlineFromSnapshot, type TiptapConversionContext } from "./core-node-converters";
import { structuredNodeFromSnapshot } from "./structured-node-converters";
import { visualBlockFromSnapshot } from "./visual-node-converters";

// Task 24.2 — read-only preview models for a structural ("edit-operations")
// Smart Mode draft. buildOperationPreview turns the ORDERED operations list
// (Task 21.1's AiEditOperationV1[], what the server already verified and
// applied via ai-writer's own applyEditOperations before this draft was ever
// returned) into an ordered list of per-operation "before"/"after" Tiptap
// JSON fragments, built ENTIRELY from a detached clone of the live document
// — nothing in this module ever touches a real Editor instance or mutates
// the caller's `liveDocument`.
//
// --- How "before" is computed per card (judgment call, documented per the
// task brief) ---------------------------------------------------------
// The plan asks whether reusing ai-writer's own applyEditOperations per
// operation-prefix is feasible here. It resolves refs via an internal,
// object-identity-based registry that apply-edit-operations.ts never
// exports (only the whole-batch `applyEditOperations` entry point is
// public) — re-running it once per prefix would only hand back a new FULL
// document each time, with no way to identify which node inside it a given
// operation actually touched (ordinary nodes carry no ref annotation of
// their own; only nodeRefs's PATHS do, and paths go stale the moment an
// earlier insert/delete/move in the batch shifts sibling indices).
//
// This module instead reimplements the much narrower piece it actually
// needs: a `Map<ref, node>` seeded once from the pristine snapshot (via
// buildEditSnapshot's own `nodeRefs` path table — resolved while the tree is
// still untouched, so every path is guaranteed valid), then walked forward
// through `operations` in order, updating each targetRef's entry exactly
// the way the real apply engine's own per-op appliers do (replaceNode/
// updateAttrs/replaceText overwrite the map entry; deleteNode removes it;
// insertNode registers its own `localRef` so a LATER operation in the same
// batch that references a just-inserted node — the documented multi-step
// batch pattern, e.g. insert a table then insert rows into it via localRef
// — resolves correctly too). This is a genuine sequence-aware simulation
// (never "just the original document for every card"), just narrower in
// scope than the real engine: it never splices arrays, re-validates limits,
// or checks protected-image invariants, because a preview card never needs
// the whole resulting tree — only the one node each operation names.
//
// --- Single-node Tiptap conversion (judgment call) -----------------------
// Task 24.1's aiSnapshotCandidateToTiptap only accepts a whole, root-valid
// `{type:"doc",...}` document (it runs parseDocumentV2 over the entire
// tree). A card's own before/after value is very often NOT a valid doc
// child by itself (a bare tableCell, listItem, choiceItem, or text node),
// so this module converts ONE node at a time by calling the same
// core/structured/visual `xFromSnapshot` family functions Task 24.1 already
// built, WITHOUT the final whole-document parseDocumentV2 pass — this is
// read-only preview rendering, not persistence, so skipping that pass here
// (while still going through every real per-node-type mapping rule) is a
// deliberate, narrower "lighter equivalent" of aiSnapshotCandidateToTiptap.
// coreBlockFromSnapshot/coreInlineFromSnapshot's own switch cases never
// share a `node.type` value, so trying both against any node (block or
// inline) is safe and needs no separate "is this a block or an inline
// node" test the way ai-snapshot-converters.ts's two-context dispatch does.

export interface OperationPreviewCard {
  readonly operationIndex: number;
  readonly action: AiEditOperationV1["type"];
  readonly nodeType: string;
  readonly before: JSONContent | null;
  readonly after: JSONContent | null;
}

export interface OperationPreviewModel {
  readonly cards: readonly OperationPreviewCard[];
}

export interface OperationPreviewDraftInput {
  readonly operations: readonly AiEditOperationV1[];
}

function snapshotNodeToTiptap(node: JSONContent, protectedImages: ProtectedImageRegistry): JSONContent {
  if (node.type === "protectedImage") {
    const ref = (node as unknown as { ref?: unknown }).ref;
    if (typeof ref !== "string" || ref.length === 0) {
      throw new AiSnapshotConversionError("A protectedImage placeholder is missing its ref.");
    }
    return structuredClone(resolveProtectedImage(protectedImages, ref));
  }
  const ctx: TiptapConversionContext = {
    block: (child) => snapshotNodeToTiptap(child, protectedImages),
    inline: (child) => snapshotNodeToTiptap(child, protectedImages),
  };
  const result =
    coreBlockFromSnapshot(node, ctx) ??
    coreInlineFromSnapshot(node, ctx) ??
    structuredNodeFromSnapshot(node, ctx) ??
    visualBlockFromSnapshot(node, ctx);
  if (!result) {
    throw new AiSnapshotConversionError(
      `Unknown node type for operation preview: "${node.type ?? "unknown"}"`,
    );
  }
  return result;
}

// --- Wrapping a single node into a standalone, schema-valid Tiptap doc ---
//
// AnvilDocument's own content model ("block+ footnotes?") and every
// container node's content model (table > tableRow > tableCell/tableHeader,
// bulletList/orderedList > listItem, question > questionItem > choiceList >
// choiceItem, footnotes > footnote, any textblock > inline content) reject
// a bare non-block-level node dropped directly under `doc`. Each entry
// below lists the exact ancestor chain (outermost first) a node of that
// type needs re-created around it before a detached preview Editor will
// accept it as `content`. `leadingBlock` covers the two container types
// whose OWN content model requires a preceding sibling before the node
// being wrapped is even reachable (questionItem needs "block+" before its
// optional choiceList; the document root needs "block+" before an optional
// trailing footnotes list) — both wrapped in the SAME plain empty
// paragraph placeholder.
interface WrapStep {
  readonly type: string;
  readonly leadingBlock?: boolean;
}

const WRAP_CHAINS: Readonly<Record<string, readonly WrapStep[]>> = {
  listItem: [{ type: "bulletList" }],
  tableRow: [{ type: "table" }],
  tableHeader: [{ type: "table" }, { type: "tableRow" }],
  tableCell: [{ type: "table" }, { type: "tableRow" }],
  questionItem: [{ type: "question" }],
  choiceList: [{ type: "question" }, { type: "questionItem", leadingBlock: true }],
  choiceItem: [
    { type: "question" },
    { type: "questionItem", leadingBlock: true },
    { type: "choiceList" },
  ],
  footnote: [{ type: "footnotes" }],
  text: [{ type: "paragraph" }],
  hardBreak: [{ type: "paragraph" }],
  inlineMath: [{ type: "paragraph" }],
  crossRef: [{ type: "paragraph" }],
  footnoteReference: [{ type: "paragraph" }],
  questionBlank: [{ type: "paragraph" }],
  inlineBlank: [{ type: "paragraph" }],
};

function emptyParagraph(): JSONContent {
  return { type: "paragraph" };
}

export function wrapNodeForPreview(node: JSONContent): JSONContent {
  const chain = WRAP_CHAINS[node.type ?? ""] ?? [];
  let wrapped: JSONContent = node;
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const step = chain[index];
    wrapped = {
      type: step.type,
      content: step.leadingBlock ? [emptyParagraph(), wrapped] : [wrapped],
    };
  }
  const rootIsFootnotes = wrapped.type === "footnotes";
  return {
    type: "doc",
    content: rootIsFootnotes ? [emptyParagraph(), wrapped] : [wrapped],
  };
}

function resolveSnapshotPath(
  document: AiSnapshotDocumentV1,
  path: readonly number[],
): JSONContent | undefined {
  let current: unknown = document;
  for (const index of path) {
    const content = (current as { content?: unknown[] } | undefined)?.content;
    if (!Array.isArray(content)) return undefined;
    current = content[index];
  }
  return current as JSONContent | undefined;
}

function buildInitialNodeByRef(snapshot: EditSnapshotV1): Map<string, JSONContent> {
  const nodeByRef = new Map<string, JSONContent>();
  for (const [ref, path] of snapshot.nodeRefs) {
    const node = resolveSnapshotPath(snapshot.document, path);
    if (node && typeof node === "object" && typeof node.type === "string") {
      nodeByRef.set(ref, node);
    }
  }
  return nodeByRef;
}

interface OperationStep {
  readonly nodeType: string;
  readonly beforeNode: JSONContent | null;
  readonly afterNode: JSONContent | null;
}

function stepOperation(op: AiEditOperationV1, nodeByRef: Map<string, JSONContent>): OperationStep {
  switch (op.type) {
    case "insertNode": {
      const node = op.node as unknown as JSONContent;
      if (op.localRef) nodeByRef.set(op.localRef, node);
      return { nodeType: node.type ?? "unknown", beforeNode: null, afterNode: node };
    }
    case "replaceNode": {
      const before = nodeByRef.get(op.targetRef) ?? null;
      const after = op.node as unknown as JSONContent;
      nodeByRef.set(op.targetRef, after);
      return { nodeType: after.type ?? "unknown", beforeNode: before, afterNode: after };
    }
    case "deleteNode": {
      const before = nodeByRef.get(op.targetRef) ?? null;
      nodeByRef.delete(op.targetRef);
      return { nodeType: before?.type ?? "unknown", beforeNode: before, afterNode: null };
    }
    case "moveNode": {
      const node = nodeByRef.get(op.targetRef) ?? null;
      return { nodeType: node?.type ?? "unknown", beforeNode: node, afterNode: node };
    }
    case "updateAttrs": {
      const before = nodeByRef.get(op.targetRef) ?? null;
      const after: JSONContent | null = before
        ? { ...before, attrs: { ...(before.attrs ?? {}), ...(op.attrs as Record<string, unknown>) } }
        : null;
      if (after) nodeByRef.set(op.targetRef, after);
      return { nodeType: op.nodeType, beforeNode: before, afterNode: after };
    }
    case "replaceText": {
      const before = nodeByRef.get(op.targetRef) ?? null;
      const after: JSONContent = {
        type: "text",
        text: op.text,
        marks: op.marks as unknown as JSONContent["marks"],
      };
      nodeByRef.set(op.targetRef, after);
      return { nodeType: "text", beforeNode: before, afterNode: after };
    }
  }
}

export function buildOperationPreview(
  liveDocument: JSONContent,
  draft: OperationPreviewDraftInput,
): OperationPreviewModel {
  const source = tiptapDocumentToAiSnapshotSource(liveDocument);
  const snapshot = buildEditSnapshot(source);
  const protectedImages = createProtectedImageRegistry(snapshot.protectedImages);
  const nodeByRef = buildInitialNodeByRef(snapshot);

  const cards: OperationPreviewCard[] = draft.operations.map((op, operationIndex) => {
    const step = stepOperation(op, nodeByRef);
    return {
      operationIndex,
      action: op.type,
      nodeType: step.nodeType,
      before: step.beforeNode
        ? wrapNodeForPreview(snapshotNodeToTiptap(step.beforeNode, protectedImages))
        : null,
      after: step.afterNode
        ? wrapNodeForPreview(snapshotNodeToTiptap(step.afterNode, protectedImages))
        : null,
    };
  });

  return { cards };
}
