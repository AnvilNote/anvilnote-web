import type { JSONContent } from "@tiptap/core";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function stableDocumentHash(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export interface SelectionSnapshot {
  requestId: string;
  documentId: string;
  from: number;
  to: number;
  selectedContent: JSONContent[];
  selectedCharacterCount: number;
  selectedFragmentHash: string;
  documentHash: string;
  capturedAt: string;
}

function characterCount(content: JSONContent[]): number {
  let total = 0;
  const visit = (node: JSONContent) => {
    if (node.type === "text") total += node.text?.length ?? 0;
    node.content?.forEach(visit);
  };
  content.forEach(visit);
  return total;
}

export function createSelectionSnapshot(input: {
  requestId: string;
  documentId: string;
  from: number;
  to: number;
  document: JSONContent;
  selectedContent: JSONContent[];
}): SelectionSnapshot {
  return {
    requestId: input.requestId,
    documentId: input.documentId,
    from: input.from,
    to: input.to,
    selectedContent: structuredClone(input.selectedContent),
    selectedCharacterCount: characterCount(input.selectedContent),
    selectedFragmentHash: stableDocumentHash(input.selectedContent),
    documentHash: stableDocumentHash(input.document),
    capturedAt: new Date().toISOString(),
  };
}

export function hasSelectionConflict(
  snapshot: SelectionSnapshot,
  current: { document: JSONContent; selectedContent: JSONContent[] },
): boolean {
  return (
    stableDocumentHash(current.selectedContent) !== snapshot.selectedFragmentHash ||
    stableDocumentHash(current.document) !== snapshot.documentHash
  );
}
