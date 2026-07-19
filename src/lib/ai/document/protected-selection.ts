import type { JSONContent } from "@tiptap/core";

type ProtectedEntry = {
  placeholder: string;
  node: JSONContent;
  kind: "inline" | "block";
};

export class ProtectedSelectionError extends Error {
  readonly code = "invalid_structured_output";

  constructor(message: string) {
    super(message);
    this.name = "ProtectedSelectionError";
  }
}

function count(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

export class ProtectedSelectionRegistry {
  private readonly entries: ProtectedEntry[] = [];
  private readonly prefix: string;

  static create(): ProtectedSelectionRegistry {
    if (!globalThis.crypto?.randomUUID) {
      throw new ProtectedSelectionError("Secure randomness is unavailable.");
    }
    return new ProtectedSelectionRegistry(globalThis.crypto.randomUUID());
  }

  private constructor(nonce: string) {
    this.prefix = `{{ANVIL_PROTECTED_${nonce}_`;
  }

  protect(node: JSONContent, kind: ProtectedEntry["kind"]): string {
    const placeholder = `${this.prefix}${String(this.entries.length + 1).padStart(4, "0")}}}`;
    this.entries.push({
      placeholder,
      node: structuredClone(node),
      kind,
    });
    return placeholder;
  }

  private validate(content: JSONContent[]): void {
    const serialized = JSON.stringify(content);
    for (const entry of this.entries) {
      if (count(serialized, entry.placeholder) !== 1) {
        throw new ProtectedSelectionError(
          "Every protected placeholder must appear exactly once.",
        );
      }
    }
    const pattern = new RegExp(
      `${this.prefix.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}[^}]+\\}\\}`,
      "gu",
    );
    for (const placeholder of serialized.match(pattern) ?? []) {
      if (!this.entries.some((entry) => entry.placeholder === placeholder)) {
        throw new ProtectedSelectionError("An unknown protected placeholder was returned.");
      }
    }
    let previous = -1;
    for (const entry of this.entries) {
      const index = serialized.indexOf(entry.placeholder);
      if (index <= previous) {
        throw new ProtectedSelectionError("Protected content order changed.");
      }
      previous = index;
    }
  }

  private restoreInline(node: JSONContent): JSONContent[] {
    if (node.type !== "text" || typeof node.text !== "string") return [node];
    const matches = this.entries
      .filter((entry) => entry.kind === "inline" && node.text?.includes(entry.placeholder))
      .sort((left, right) =>
        (node.text?.indexOf(left.placeholder) ?? 0) -
        (node.text?.indexOf(right.placeholder) ?? 0),
      );
    if (matches.length === 0) return [node];
    const output: JSONContent[] = [];
    let offset = 0;
    for (const entry of matches) {
      const index = node.text.indexOf(entry.placeholder, offset);
      const before = node.text.slice(offset, index);
      if (before) output.push({ ...node, text: before });
      output.push(structuredClone(entry.node));
      offset = index + entry.placeholder.length;
    }
    const after = node.text.slice(offset);
    if (after) output.push({ ...node, text: after });
    return output;
  }

  restore(content: JSONContent[]): JSONContent[] {
    this.validate(content);
    const restoreNode = (node: JSONContent): JSONContent[] => {
      const blockEntry = this.entries.find(
        (entry) =>
          entry.kind === "block" &&
          node.type === "paragraph" &&
          node.content?.length === 1 &&
          node.content[0]?.type === "text" &&
          node.content[0]?.text === entry.placeholder,
      );
      if (blockEntry) return [structuredClone(blockEntry.node)];
      if (node.type === "text") return this.restoreInline(node);
      if (!node.content) return [node];
      return [
        {
          ...node,
          content: node.content.flatMap(restoreNode),
        },
      ];
    };
    return content.flatMap(restoreNode);
  }
}
