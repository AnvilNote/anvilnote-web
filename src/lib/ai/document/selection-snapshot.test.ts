import { describe, expect, it } from "vitest";
import { createSelectionSnapshot, hasSelectionConflict } from "./selection-snapshot";

const document = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Before" }] },
    { type: "paragraph", content: [{ type: "text", text: "Selected" }] },
  ],
};

describe("selection snapshots", () => {
  it("uses stable hashes and detects selected-fragment changes", async () => {
    const snapshot = await createSelectionSnapshot({
      requestId: "req-1",
      documentId: "doc-1",
      from: 9,
      to: 17,
      document,
      selectedContent: [document.content[1]],
    });
    expect(
      await hasSelectionConflict(snapshot, {
        document,
        selectedContent: [document.content[1]],
      }),
    ).toBe(false);
    expect(
      await hasSelectionConflict(snapshot, {
        document: {
          ...document,
          content: [document.content[0], { type: "paragraph", content: [{ type: "text", text: "Changed" }] }],
        },
        selectedContent: [{ type: "paragraph", content: [{ type: "text", text: "Changed" }] }],
      }),
    ).toBe(true);
  });
});
