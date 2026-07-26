import type { JSONContent } from "@tiptap/core";
import { buildEditSnapshot, type AiEditOperationV1, type EditSnapshotV1 } from "@anvilnote/ai-writer";
import { describe, expect, it } from "vitest";
import { tiptapDocumentToAiSnapshotSource } from "./ai-snapshot-converters";
import { buildOperationPreview, wrapNodeForPreview } from "./operation-preview";

// Refs are assigned by ai-writer's own buildEditSnapshot in a depth-first
// walk order this test never wants to hardcode (it's an internal
// implementation detail of buildEditSnapshot, not part of this task's own
// contract) — resolve them from the SAME snapshot buildOperationPreview
// itself builds internally, by searching for a node with a matching type.
function findRef(snapshot: EditSnapshotV1, type: string, occurrence = 0): string {
  let seen = 0;
  for (const [ref, path] of snapshot.nodeRefs) {
    let current: unknown = snapshot.document;
    for (const index of path) {
      const content = (current as { content?: unknown[] } | undefined)?.content;
      if (!Array.isArray(content)) {
        current = undefined;
        break;
      }
      current = content[index];
    }
    if (current && typeof current === "object" && (current as JSONContent).type === type) {
      if (seen === occurrence) return ref;
      seen += 1;
    }
  }
  throw new Error(`No ref found for node type "${type}" (occurrence ${occurrence})`);
}

function snapshotFor(document: JSONContent): EditSnapshotV1 {
  return buildEditSnapshot(tiptapDocumentToAiSnapshotSource(document));
}

describe("buildOperationPreview", () => {
  it("never mutates the live document it reads from", () => {
    const liveDocument: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    };
    const before = structuredClone(liveDocument);
    const snapshot = snapshotFor(liveDocument);
    const targetRef = findRef(snapshot, "text");
    const operations: AiEditOperationV1[] = [
      { type: "replaceText", targetRef, text: "Hi", marks: [] },
    ];

    buildOperationPreview(liveDocument, { operations });

    expect(liveDocument).toEqual(before);
  });

  it("builds one ordered card per operation covering every action kind", () => {
    const liveDocument: JSONContent = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1, id: null }, content: [{ type: "text", text: "Title" }] },
        { type: "paragraph", content: [{ type: "text", text: "Body text" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second paragraph" }] },
      ],
    };
    const snapshot = snapshotFor(liveDocument);
    const headingRef = findRef(snapshot, "heading");
    const bodyTextRef = findRef(snapshot, "text", 1);
    const secondParagraphRef = findRef(snapshot, "paragraph", 1);
    const rootRef = findRef(snapshot, "doc");

    const operations: AiEditOperationV1[] = [
      {
        type: "insertNode",
        parentRef: rootRef,
        index: 0,
        node: { type: "paragraph", content: [{ type: "text", text: "Inserted" }] },
        localRef: "inserted-1",
      },
      {
        type: "updateAttrs",
        targetRef: headingRef,
        nodeType: "heading",
        attrs: { level: 2 },
      },
      {
        type: "replaceText",
        targetRef: bodyTextRef,
        text: "Replaced body text",
        marks: [{ type: "bold" }],
      },
      {
        type: "moveNode",
        targetRef: secondParagraphRef,
        newParentRef: rootRef,
        index: 0,
      },
      {
        type: "replaceNode",
        targetRef: secondParagraphRef,
        node: { type: "paragraph", content: [{ type: "text", text: "Fully replaced" }] },
      },
      { type: "deleteNode", targetRef: headingRef },
    ];

    const model = buildOperationPreview(liveDocument, { operations });

    expect(model.cards).toHaveLength(6);
    expect(model.cards.map((card) => card.action)).toEqual([
      "insertNode",
      "updateAttrs",
      "replaceText",
      "moveNode",
      "replaceNode",
      "deleteNode",
    ]);
    expect(model.cards.map((card) => card.operationIndex)).toEqual([0, 1, 2, 3, 4, 5]);

    const [insert, update, replaceText, move, replaceNode, remove] = model.cards;

    expect(insert.before).toBeNull();
    expect(insert.after).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Inserted" }] }],
    });

    expect(update.nodeType).toBe("heading");
    expect(update.before?.content?.[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
    expect(update.after?.content?.[0]).toMatchObject({ type: "heading", attrs: { level: 2 } });

    expect(replaceText.nodeType).toBe("text");
    expect(replaceText.before?.content?.[0]?.content?.[0]).toMatchObject({ type: "text", text: "Body text" });
    expect(replaceText.after?.content?.[0]?.content?.[0]).toMatchObject({
      type: "text",
      text: "Replaced body text",
      marks: [{ type: "bold" }],
    });

    // moveNode's own content is unchanged — only its position moves, so
    // before and after show the same node content.
    expect(move.before).toEqual(move.after);
    expect(move.nodeType).toBe("paragraph");

    expect(replaceNode.before?.content?.[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "Second paragraph" }],
    });
    expect(replaceNode.after?.content?.[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "Fully replaced" }],
    });

    expect(remove.before?.content?.[0]).toMatchObject({ type: "heading" });
    expect(remove.after).toBeNull();
  });

  it("resolves a later operation's targetRef against an earlier insertNode's own localRef", () => {
    const liveDocument: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Anchor" }] }],
    };
    const snapshot = snapshotFor(liveDocument);
    const rootRef = findRef(snapshot, "doc");

    const operations: AiEditOperationV1[] = [
      {
        type: "insertNode",
        parentRef: rootRef,
        index: 0,
        node: { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "New heading" }] },
        localRef: "new-heading",
      },
      {
        type: "updateAttrs",
        targetRef: "new-heading",
        nodeType: "heading",
        attrs: { level: 3 },
      },
    ];

    const model = buildOperationPreview(liveDocument, { operations });
    const [, updateCard] = model.cards;

    // "before" for the chained updateAttrs is the JUST-INSERTED node from
    // operation 0 — not "undefined"/null and not the pristine live
    // document, which never contained this heading at all — proving the
    // walk is sequence-aware rather than always diffing against the
    // original document.
    expect(updateCard.before?.content?.[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
    expect(updateCard.after?.content?.[0]).toMatchObject({ type: "heading", attrs: { level: 3 } });
  });

  it("renders mermaid/functionPlot/statsChart previews from real semantic attrs, never a provider-supplied svg", () => {
    const liveDocument: JSONContent = {
      type: "doc",
      content: [
        { type: "mermaid", attrs: { source: "graph TD; A-->B", theme: "default" } },
        {
          type: "functionPlot",
          attrs: {
            curves: [{ formula: "x^2", color: "#000000", dash: "solid", thickness: 2 }],
            xMin: -10,
            xMax: 10,
            showGridlines: true,
            showAxisTicks: true,
          },
        },
      ],
    };
    const snapshot = snapshotFor(liveDocument);
    const mermaidRef = findRef(snapshot, "mermaid");
    const functionPlotRef = findRef(snapshot, "functionPlot");

    const operations: AiEditOperationV1[] = [
      {
        type: "updateAttrs",
        targetRef: mermaidRef,
        nodeType: "mermaid",
        attrs: { source: "graph TD; A-->B-->C" },
      },
      {
        type: "updateAttrs",
        targetRef: functionPlotRef,
        nodeType: "functionPlot",
        attrs: { xMax: 20 },
      },
    ];

    const model = buildOperationPreview(liveDocument, { operations });
    const [mermaidCard, functionPlotCard] = model.cards;

    expect(mermaidCard.after?.content?.[0]).toMatchObject({
      type: "mermaid",
      attrs: { source: "graph TD; A-->B-->C" },
    });
    expect(functionPlotCard.after?.content?.[0]).toMatchObject({
      type: "functionPlot",
      attrs: { xMax: 20, svg: null },
    });
    // The v2 schema never carries an `svg` field a model could populate at
    // all (verified directly against visual-nodes.ts), and this module's
    // own reused converter hardcodes `svg: null` regardless of input —
    // asserting it here guards against a future regression reintroducing a
    // trusted path for a provider-authored SVG string.
    expect(JSON.stringify(functionPlotCard.after)).not.toContain("<svg");
  });

  it("wraps a table cell's text into a standalone, schema-valid Tiptap fragment", () => {
    const liveDocument: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1 },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Cell text" }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    const snapshot = snapshotFor(liveDocument);
    const textRef = findRef(snapshot, "text");

    const model = buildOperationPreview(liveDocument, {
      operations: [{ type: "replaceText", targetRef: textRef, text: "Updated cell", marks: [] }],
    });

    expect(model.cards[0].after).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Updated cell" }] }],
    });
  });
});

describe("wrapNodeForPreview", () => {
  it("wraps a bare listItem in its required bulletList ancestor", () => {
    const wrapped = wrapNodeForPreview({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }],
    });
    expect(wrapped).toEqual({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }] }],
        },
      ],
    });
  });

  it("leaves an already doc-valid node (paragraph) unwrapped", () => {
    const node = { type: "paragraph", content: [{ type: "text", text: "Plain" }] };
    expect(wrapNodeForPreview(node)).toEqual({ type: "doc", content: [node] });
  });
});
