// Shared error type + exhaustiveness helper for the V2 "AI edit snapshot"
// conversion pipeline (tiptapDocumentToAiSnapshotSource/
// aiSnapshotCandidateToTiptap in converters.ts, and the per-node-family
// converter modules that back them). Deliberately a NEW, separate error
// class from the OLD V1 path's UnsupportedAIContentError (converters.ts) —
// the two conversion pipelines are independent (see converters.ts's own
// header comment for why both still exist), and callers of the OLD flow
// (smart-mode-panel.tsx/tiptap-bubble-menu.tsx) narrow on
// UnsupportedAIContentError specifically; reusing that class for the NEW
// V2 path's very different failure shapes (a Zod structural error, an
// unresolved protected-image ref, ...) would blur that boundary.
export class AiSnapshotConversionError extends Error {
  readonly code = "unsupported_ai_snapshot";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiSnapshotConversionError";
  }
}

// Compile-time exhaustiveness check for the REVERSE (validated AiDocumentV2
// -> Tiptap JSON) direction, whose switches operate over a real discriminated
// union (AiBlockNodeV2/AiInlineNodeV2/...), so TypeScript can actually prove
// every member was handled. The FORWARD (raw Tiptap JSON -> V2) direction's
// switches instead end in a runtime "unknown node type" throw (via this same
// function, called with a value TypeScript can't narrow to `never` since raw
// JSONContent's `type` is just `string`) — same fail-closed intent, just
// without the compile-time guarantee an untyped external input can't offer.
export function assertNever(value: never, context: string): never {
  throw new AiSnapshotConversionError(
    `${context}: unexpected node shape ${JSON.stringify(value)}`,
  );
}
