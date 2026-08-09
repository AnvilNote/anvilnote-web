import { describe, expect, test } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Mathematics } from "@tiptap/extension-mathematics";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { AnvilCallout } from "./callout";
import { AnvilChart } from "./chart";
import { AnvilImage } from "./image";
import { AnvilProof } from "./proof";
import { AnvilMermaid } from "./mermaid";
import { AnvilImageRow } from "./image-row";
import { AnvilQuestion, AnvilQuestionItem, AnvilChoiceList, AnvilChoiceItem } from "./question";

// Every node type callout.ts's own `content` expression string references
// has to actually be registered, or ProseMirror's schema-building throws
// at Editor-construction time — this list mirrors extensions.ts's real
// registration (minus everything callout content doesn't mention).
function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      Mathematics,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      AnvilImage,
      AnvilProof,
      AnvilMermaid,
      AnvilImageRow,
      AnvilCallout,
      AnvilChart,
      AnvilQuestion,
      AnvilQuestionItem,
      AnvilChoiceList,
      AnvilChoiceItem,
    ],
    content: "<p></p>",
  });
}

describe("callout content schema", () => {
  test("accepts a chart node as content, matching image/mermaid/table", () => {
    const editor = makeEditor();
    editor.commands.insertContent({
      type: "callout",
      attrs: { kind: "tip" },
      content: [{ type: "chart", attrs: { chartType: "bar", spec: "{}" } }],
    });

    const callout = editor.state.doc.content.firstChild;
    expect(callout?.type.name).toBe("callout");
    expect(callout?.firstChild?.type.name).toBe("chart");
    editor.destroy();
  });

  test("callout's own content spec permits chart (schema-level check, not just insertContent leniency)", () => {
    const editor = makeEditor();
    const chartType = editor.schema.nodes.chart;
    const calloutType = editor.schema.nodes.callout;
    const chartNode = chartType.create({ chartType: "bar", spec: "{}" });
    expect(calloutType.contentMatch.matchType(chartNode.type)).not.toBeNull();
    editor.destroy();
  });

  test("accepts a question node as content, e.g. dragging a question block into a callout", () => {
    const editor = makeEditor();
    editor.commands.insertContent({
      type: "callout",
      attrs: { kind: "tip" },
      content: [
        {
          type: "question",
          content: [
            {
              type: "questionItem",
              attrs: { kind: "written" },
              content: [{ type: "paragraph" }],
            },
          ],
        },
      ],
    });

    const callout = editor.state.doc.content.firstChild;
    expect(callout?.type.name).toBe("callout");
    expect(callout?.firstChild?.type.name).toBe("question");
    editor.destroy();
  });

  test("callout's own content spec permits question (schema-level check — this is what the drag-handle's drop validation actually reads)", () => {
    const editor = makeEditor();
    const questionType = editor.schema.nodes.question;
    const calloutType = editor.schema.nodes.callout;
    const questionItemNode = editor.schema.nodes.questionItem.create(
      { kind: "written" },
      editor.schema.nodes.paragraph.create(),
    );
    const questionNode = questionType.create(null, questionItemNode);
    expect(calloutType.contentMatch.matchType(questionNode.type)).not.toBeNull();
    editor.destroy();
  });
});
