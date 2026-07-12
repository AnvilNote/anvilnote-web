import assert from "node:assert/strict";
import test from "node:test";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { CellSelection, tableNodes } from "@tiptap/pm/tables";
import { setCellAttributeAcrossSelection } from "./table-selection.ts";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "text*" },
    text: {},
    ...tableNodes({
      tableGroup: "block",
      cellContent: "paragraph+",
      cellAttributes: {
        align: { default: null },
      },
    }),
  },
});

const paragraph = (text: string) => schema.node("paragraph", null, text ? [schema.text(text)] : []);

test("updates every selected cell even when the anchor already has the value", () => {
  const first = schema.node("table_cell", { align: "center" }, [paragraph("A")]);
  const second = schema.node("table_cell", null, [paragraph("B")]);
  const row = schema.node("table_row", null, [first, second]);
  const doc = schema.node("doc", null, [schema.node("table", null, [row])]);
  const firstCellPos = 2;
  const secondCellPos = firstCellPos + first.nodeSize;
  const state = EditorState.create({
    doc,
    selection: CellSelection.create(doc, firstCellPos, secondCellPos),
  });

  const transaction = setCellAttributeAcrossSelection(state, "align", "center");

  assert.ok(transaction?.docChanged);
  assert.equal(transaction?.doc.nodeAt(firstCellPos)?.attrs.align, "center");
  assert.equal(transaction?.doc.nodeAt(secondCellPos)?.attrs.align, "center");
});
