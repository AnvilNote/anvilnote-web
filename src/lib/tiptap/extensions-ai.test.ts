import { describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { buildExtensions } from "./extensions";
import {
  AI_NODE_CAPABILITIES,
  AI_MARK_CAPABILITIES,
  assertRegisteredCapabilities,
} from "@anvilnote/ai-writer/document";

// buildExtensions()'s own returned array is NOT the flattened schema — some
// entries (StarterKit, @tiptap/extension-mathematics) are themselves single
// `type: "extension"` items whose OWN addExtensions() registers further node
// types (paragraph/text/heading/bold/italic/... and inlineMath/blockMath
// respectively) that never show up as separate items in that raw array.
// Only building a real Editor and reading its resolved `schema.nodes` /
// `schema.marks` reflects the actual content model the running app uses —
// confirmed by probing both approaches directly: the raw array under-reports
// dozens of real node/mark types that only a real Editor's schema exposes.
function buildTestEditor() {
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
    choicePlaceholder: (label: string) => `Choice ${label}`,
    tableHeaderPlaceholder: "Header",
    tableCellPlaceholder: "Cell",
    onMathClick: vi.fn(),
  });
  return new Editor({ extensions });
}

describe("production editor extensions", () => {
  it("stores strong and weak page breaks as atomic document nodes", () => {
    const editor = buildTestEditor();
    try {
      editor.commands.setContent({
        type: "doc",
        content: [
          { type: "pageBreak", attrs: { weak: false } },
          { type: "pageBreak", attrs: { weak: true } },
        ],
      });

      expect(editor.getJSON()).toEqual({
        type: "doc",
        content: [
          { type: "pageBreak", attrs: { weak: false } },
          { type: "pageBreak", attrs: { weak: true } },
          { type: "paragraph", attrs: { indent: 0 } },
        ],
      });
    } finally {
      editor.destroy();
    }
  });

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

  it("renders historical malformed math without KaTeX strict-mode warning spam", () => {
    const editor = buildTestEditor();
    try {
      expect(
        editor.extensionManager.extensions.find(
          (extension) => extension.name === "inlineMath",
        )?.options.katexOptions,
      ).toMatchObject({ throwOnError: false, strict: false });
      expect(
        editor.extensionManager.extensions.find(
          (extension) => extension.name === "blockMath",
        )?.options.katexOptions,
      ).toMatchObject({ throwOnError: false, strict: false });
    } finally {
      editor.destroy();
    }
  });

  it("has an AI capability entry for every node/mark the real editor schema registers", () => {
    const editor = buildTestEditor();
    try {
      const nodes = Object.keys(editor.schema.nodes);
      const marks = Object.keys(editor.schema.marks);

      // Fails loudly with the exact missing/extra names (not just a boolean)
      // the moment a new editor extension is registered in extensions.ts
      // without a matching capability-manifest.ts entry, or vice versa.
      expect(() => assertRegisteredCapabilities({ nodes, marks })).not.toThrow();
    } finally {
      editor.destroy();
    }
  });

  it("classifies only image and imageRow as protected in the real editor schema", () => {
    const editor = buildTestEditor();
    try {
      const registeredNodeNames = new Set(Object.keys(editor.schema.nodes));

      const protectedInEditor = Object.entries(AI_NODE_CAPABILITIES)
        .filter(([name, policy]) => policy === "protected-image" && registeredNodeNames.has(name))
        .map(([name]) => name)
        .sort();

      expect(protectedInEditor).toEqual(["image", "imageRow"]);
    } finally {
      editor.destroy();
    }
  });

  it("classifies every registered mark as editable", () => {
    const editor = buildTestEditor();
    try {
      const registeredMarkNames = Object.keys(editor.schema.marks);
      for (const name of registeredMarkNames) {
        expect(AI_MARK_CAPABILITIES[name as keyof typeof AI_MARK_CAPABILITIES]).toBe("editable");
      }
    } finally {
      editor.destroy();
    }
  });
});
