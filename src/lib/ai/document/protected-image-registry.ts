import type { ProtectedImageRecord } from "@anvilnote/ai-writer";
import type { JSONContent } from "@tiptap/core";
import { AiSnapshotConversionError } from "./ai-snapshot-errors";

// NOT a real existing type anywhere in @anvilnote/ai-writer (confirmed by
// grep before adding this) — a thin web-side wrapper around ai-writer's own
// `EditSnapshotV1.protectedImages: readonly ProtectedImageRecord[]`, giving
// `aiSnapshotCandidateToTiptap` a simple ref -> real-Tiptap-JSON lookup so it
// can splice a protectedImage placeholder back into a real image/imageRow
// node. `canonicalSubtree` is a canonical JSON STRING of the original raw
// node (captured by buildEditSnapshot via canonicalJSONStringify) — parsing
// it back out reproduces the same node value (key order may differ from the
// true original, which is irrelevant for JS object equality/deepEqual).
export interface ProtectedImageRegistry {
  get(ref: string): JSONContent | undefined;
}

export function createProtectedImageRegistry(
  records: readonly ProtectedImageRecord[],
): ProtectedImageRegistry {
  const byRef = new Map<string, JSONContent>(
    records.map((record) => [record.ref, JSON.parse(record.canonicalSubtree) as JSONContent]),
  );
  return {
    get(ref: string) {
      return byRef.get(ref);
    },
  };
}

export function resolveProtectedImage(registry: ProtectedImageRegistry, ref: string): JSONContent {
  const node = registry.get(ref);
  if (!node) {
    throw new AiSnapshotConversionError(`Unresolved protected image reference: ${ref}`);
  }
  return node;
}
