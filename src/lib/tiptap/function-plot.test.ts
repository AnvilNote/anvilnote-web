import { describe, expect, test } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  AnvilFunctionPlot,
  defaultFunctionPlotSpec,
  insertFunctionPlot,
} from "./function-plot";

function makeEditor() {
  return new Editor({
    extensions: [StarterKit, AnvilFunctionPlot],
    content: "<p></p>",
  });
}

describe("function plot node", () => {
  test("uses the funcs document contract", () => {
    const spec = defaultFunctionPlotSpec();
    expect(spec.mode).toBe("2d");
    expect(spec.curves[0]).toMatchObject({
      expr: "",
      color: "#000000",
      label: "f",
    });
    expect(spec.grid).toEqual({ enabled: false, step: 1 });
  });

  test("inserts a functionPlot node", () => {
    const editor = makeEditor();
    insertFunctionPlot(editor);
    expect(editor.state.doc.content.firstChild?.type.name).toBe("functionPlot");
    editor.destroy();
  });

  test("reads legacy formula curves and malformed JSON safely", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      '<div data-type="function-plot" data-curves="[{&quot;formula&quot;:&quot;x**2&quot;}]"></div>',
    );
    expect(editor.state.doc.content.firstChild?.attrs.curves[0].expr).toBe(
      "x**2",
    );
    editor.commands.setContent(
      '<div data-type="function-plot" data-curves="not json"></div>',
    );
    expect(editor.state.doc.content.firstChild?.attrs.curves[0].expr).toBe("");
    editor.destroy();
  });

  test("legacy curves without a label field round-trip with no label, not an auto name", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      '<div data-type="function-plot" data-curves="[{&quot;expr&quot;:&quot;x&quot;}]"></div>',
    );
    expect(editor.state.doc.content.firstChild?.attrs.curves[0].label).toBe(null);
    editor.destroy();
  });
});
