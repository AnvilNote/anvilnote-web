import { describe, expect, it, vi } from "vitest";
import { buildExtensions } from "./extensions";

describe("production editor extensions", () => {
  it("installs the inline AI decoration plugin when the editor is created", () => {
    const extensions = buildExtensions({
      placeholder: "Write",
      figureLabel: "Figure",
      tableLabel: "Table",
      figureCaptionPlaceholder: "Caption",
      tableCaptionPlaceholder: "Caption",
      tableDeleteLabel: "Delete",
      tableAddRowLabel: "Add row",
      tableAddColumnLabel: "Add column",
      tableResizeRowLabel: "Resize row",
      tableResizeColumnLabel: "Resize column",
      questionBodyPlaceholder: "Question",
      choicePlaceholder: (label) => `Choice ${label}`,
      tableHeaderPlaceholder: "Header",
      tableCellPlaceholder: "Cell",
      onMathClick: vi.fn(),
    });

    expect(extensions.map((extension) => extension.name)).toContain("anvilNoteInlineAIDiff");
  });
});
