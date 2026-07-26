import { describe, expect, it } from "vitest";
import { buildEditSnapshot } from "@anvilnote/ai-writer";
import {
  aiSnapshotCandidateToTiptap,
  anvilNoteDocumentToTiptap,
  anvilNoteFragmentToTiptap,
  tiptapDocumentToAiSnapshotSource,
  tiptapDocumentToAnvilNote,
  tiptapSelectionToAnvilNote,
  UnsupportedAIContentError,
} from "./converters";
import { AiSnapshotConversionError } from "./ai-snapshot-errors";
import { createProtectedImageRegistry } from "./protected-image-registry";
import { ProtectedSelectionRegistry } from "./protected-selection";
import type { JSONContent } from "@tiptap/core";

const richDocument: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2, id: "intro" },
      content: [
        {
          type: "text",
          text: "Heading",
          marks: [
            { type: "bold" },
            { type: "italic" },
            { type: "underline" },
            { type: "strike" },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      attrs: { indent: 2 },
      content: [
        { type: "text", text: "Visit " },
        {
          type: "text",
          text: "AnvilNote",
          marks: [
            {
              type: "link",
              attrs: { href: "https://anvilnote.example", title: "Site", target: "_blank" },
            },
          ],
        },
        { type: "hardBreak" },
        { type: "inlineMath", attrs: { latex: "x^2" } },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 3 },
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }],
        },
      ],
    },
    {
      type: "blockquote",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Quote" }] }],
    },
    {
      type: "codeBlock",
      attrs: { language: "typescript" },
      content: [{ type: "text", text: "const x = 1" }],
    },
    {
      type: "blockMath",
      attrs: { latex: "E=mc^2", id: "eq-1", equationNumber: "1", refName: "energy" },
    },
    {
      type: "table",
      attrs: { id: "table-1", caption: "Values", variant: "three-line", align: "center" },
      content: [
        {
          type: "tableRow",
          attrs: { rowHeight: 42 },
          content: [
            {
              type: "tableHeader",
              attrs: { colspan: 1, rowspan: 1, colwidth: [160] },
              content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
            },
            {
              type: "tableCell",
              attrs: { colspan: 2, rowspan: 1, colwidth: [80, 80] },
              content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }],
            },
          ],
        },
      ],
    },
    { type: "horizontalRule", attrs: { thicknessPt: 1.5, lineStyle: "dashed" } },
  ],
};

describe("Tiptap and AnvilNote AI AST converters", () => {
  it("round-trips supported blocks, inline nodes, marks, math, and table geometry", () => {
    const ai = tiptapDocumentToAnvilNote(richDocument);
    expect(anvilNoteDocumentToTiptap(ai)).toEqual(richDocument);
  });

  it("wraps a partial inline selection in a paragraph fragment", () => {
    expect(
      tiptapSelectionToAnvilNote([
        { type: "text", text: "selected", marks: [{ type: "bold" }] },
      ]),
    ).toEqual({
      schemaVersion: "anvilnote.fragment.v1",
      type: "fragment",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "selected", marks: [{ type: "bold" }] }],
        },
      ],
    });
  });

  it("round-trips canonical callouts without degrading them to blockquotes", () => {
    const callout: JSONContent = {
      type: "callout",
      attrs: { kind: "tip", title: "關鍵提醒", titleTouched: true },
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "令 " },
            { type: "inlineMath", attrs: { latex: "0 < |x-a| < delta" } },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "檢查範圍" }],
                },
              ],
            },
          ],
        },
        { type: "blockMath", attrs: { latex: "L=M" } },
      ],
    };
    const ai = tiptapDocumentToAnvilNote({ type: "doc", content: [callout] });
    expect(ai.content[0]?.type).toBe("callout");
    expect(anvilNoteDocumentToTiptap(ai)).toEqual({
      type: "doc",
      content: [callout],
    });
  });

  it("maps a nullable AI callout title to the existing default-title presentation", () => {
    expect(
      anvilNoteDocumentToTiptap({
        schemaVersion: "anvilnote.document.v1",
        type: "doc",
        content: [
          {
            type: "callout",
            attrs: { kind: "warning", title: null },
            content: [{ type: "paragraph", content: [] }],
          },
        ],
      } as never),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { kind: "warning", title: "", titleTouched: false },
          content: [{ type: "paragraph", content: [] }],
        },
      ],
    });
  });

  it("fails closed for unknown callout kinds and illegal callout children", () => {
    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [
          {
            type: "callout",
            attrs: { kind: "future", title: "Future", titleTouched: true },
            content: [{ type: "paragraph" }],
          },
        ],
      }),
    ).toThrow(UnsupportedAIContentError);
    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [
          {
            type: "callout",
            attrs: { kind: "tip", title: "Tip", titleTouched: true },
            content: [{ type: "heading", attrs: { level: 2 } }],
          },
        ],
      }),
    ).toThrow();
  });

  it("round-trips the native Proof/QED environment", () => {
    const proof: JSONContent = {
      type: "proof",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "由定義可知 " },
            { type: "inlineMath", attrs: { latex: "L=M" } },
            { type: "text", text: "。" },
          ],
        },
        { type: "blockMath", attrs: { latex: "L=M" } },
      ],
    };
    const ai = tiptapDocumentToAnvilNote({ type: "doc", content: [proof] });
    expect(ai.content[0]?.type).toBe("proof");
    expect(anvilNoteDocumentToTiptap(ai)).toEqual({
      type: "doc",
      content: [proof],
    });
  });

  it("round-trips all three native question kinds and rich choices", () => {
    const baseAttrs = {
      writtenMode: "lines",
      writtenLines: 3,
      writtenHeightPercent: 20,
      writtenHeightCm: null,
      multiForceOneColumn: true,
      stashedChoiceJSON: null,
    };
    const question: JSONContent = {
      type: "question",
      content: [
        {
          type: "questionItem",
          attrs: { ...baseAttrs, kind: "single" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "選出正確敘述。" }],
            },
            {
              type: "choiceList",
              content: [
                {
                  type: "choiceItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "答案 " },
                        { type: "inlineMath", attrs: { latex: "L" } },
                      ],
                    },
                  ],
                },
                {
                  type: "choiceItem",
                  content: [{ type: "blockMath", attrs: { latex: "L=M" } }],
                },
              ],
            },
          ],
        },
        {
          type: "questionItem",
          attrs: {
            ...baseAttrs,
            kind: "multi",
            multiForceOneColumn: false,
          },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "可複選。" }] },
            {
              type: "choiceList",
              content: [
                { type: "choiceItem", content: [{ type: "paragraph", content: [] }] },
                { type: "choiceItem", content: [{ type: "paragraph", content: [] }] },
              ],
            },
          ],
        },
        {
          type: "questionItem",
          attrs: {
            ...baseAttrs,
            kind: "written",
            writtenMode: "blank",
            writtenHeightPercent: 30,
            writtenHeightCm: 7.2,
          },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "請證明。" }] },
          ],
        },
      ],
    };
    const ai = tiptapDocumentToAnvilNote({ type: "doc", content: [question] });
    expect(ai.content[0]?.type).toBe("question");
    expect(anvilNoteDocumentToTiptap(ai)).toEqual({
      type: "doc",
      content: [question],
    });
  });

  it("fails closed for hidden stashed choices and unsupported question content", () => {
    const attrs = {
      kind: "single",
      writtenMode: "lines",
      writtenLines: 3,
      writtenHeightPercent: 20,
      writtenHeightCm: null,
      multiForceOneColumn: true,
      stashedChoiceJSON: JSON.stringify({
        type: "choiceItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hidden" }] }],
      }),
    };
    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [
          {
            type: "question",
            content: [
              {
                type: "questionItem",
                attrs,
                content: [{ type: "paragraph", content: [] }],
              },
            ],
          },
        ],
      }),
    ).toThrow(UnsupportedAIContentError);

    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [
          {
            type: "question",
            content: [
              {
                type: "questionItem",
                attrs: { ...attrs, stashedChoiceJSON: null },
                content: [
                  { type: "paragraph", content: [] },
                  {
                    type: "choiceList",
                    content: [
                      {
                        type: "choiceItem",
                        content: [{ type: "image", attrs: { src: "x" } }],
                      },
                      { type: "choiceItem", content: [{ type: "paragraph", content: [] }] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(UnsupportedAIContentError);
  });

  it("blocks unknown nodes, unsafe marks, and unsupported cell styling without data loss", () => {
    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [{ type: "image", attrs: { src: "data:image/png;base64,x" } }],
      }),
    ).toThrow(UnsupportedAIContentError);
    expect(() =>
      tiptapDocumentToAnvilNote({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "highlight" }] }] },
        ],
      }),
    ).toThrow(/highlight/);
    expect(() =>
      tiptapDocumentToAnvilNote({
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
                    attrs: { colspan: 1, rowspan: 1, colwidth: null, fill: "#ffffff" },
                    content: [{ type: "paragraph" }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(/fill/);
  });

  it("protects and restores footnote references and cross-references exactly", () => {
    const registry = ProtectedSelectionRegistry.create();
    const fragment = tiptapSelectionToAnvilNote(
      [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            { type: "footnoteReference", attrs: { footnoteId: "fn-1", label: "1" } },
            { type: "text", text: " and " },
            { type: "crossRef", attrs: { targetId: "eq-1", targetType: "equation" } },
          ],
        },
      ],
      registry,
    );
    expect(anvilNoteFragmentToTiptap(fragment, registry)).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "See " },
          { type: "footnoteReference", attrs: { footnoteId: "fn-1", label: "1" } },
          { type: "text", text: " and " },
          { type: "crossRef", attrs: { targetId: "eq-1", targetType: "equation" } },
        ],
      },
    ]);
  });

  it("fails closed when protected placeholders are missing or duplicated", () => {
    const registry = ProtectedSelectionRegistry.create();
    const fragment = tiptapSelectionToAnvilNote(
      [
        {
          type: "paragraph",
          content: [{ type: "crossRef", attrs: { targetId: "eq-1" } }],
        },
      ],
      registry,
    );
    expect(() =>
      anvilNoteFragmentToTiptap({ ...fragment, content: [{ type: "paragraph", content: [] }] }, registry),
    ).toThrow(/exactly once/);
    const protectedBlock = fragment.content[0];
    if (protectedBlock.type !== "paragraph" || protectedBlock.content[0]?.type !== "text") {
      throw new Error("Expected a protected paragraph placeholder.");
    }
    const placeholder = protectedBlock.content[0].text;
    expect(() =>
      anvilNoteFragmentToTiptap(
        {
          ...fragment,
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: placeholder },
                { type: "text", text: placeholder },
              ],
            },
          ],
        },
        registry,
      ),
    ).toThrow(/exactly once/);
  });
});

// ============================================================================
// V2 canonical AST conversion (Task 24.1) — tiptapDocumentToAiSnapshotSource /
// aiSnapshotCandidateToTiptap, the NEW full-structure Smart Mode conversion
// pipeline. Completely independent of every test above (which exercises the
// OLD, still-live V1 path) — see converters.ts's own header comment on the
// new section for why both coexist.

// Strips fields from a Tiptap JSON tree that are EXPECTED to legitimately
// differ between an original document and one restored from an AI edit
// snapshot, because the real editor recomputes them live rather than
// treating them as durable content:
//   - `svg` (mermaid/functionPlot/statsChart): a rendered-output cache the
//     V2 payload never carries at all (mermaid.ts doesn't even declare an
//     `svg` attr — see visual-node-converters.ts's header comment); the
//     restored node always gets `svg: null`/omitted instead of the
//     original cached string.
//   - `resolvedKind`/`resolvedValue`/`broken` (crossRef), `resolvedValue`/
//     `broken` (questionBlank): recomputed on every doc change by
//     cross-ref.ts's CrossRefTargetIds resolver plugin — never meaningful
//     input, always reset to their schema defaults on restore.
//   - `equationNumber` (blockMath): same resolver plugin, same treatment
//     (only referenced equations get numbered, recomputed live).
//   - `referenceNumber`/`class`/`href` (footnoteReference): `referenceNumber`
//     is recomputed every transaction by tiptap-footnotes' own
//     footnoteRules plugin (sequential position among ALL footnote
//     references in the doc); `class`/`href` are fixed/derived HTML-render
//     attrs, never meaningful content.
//   - `id` (footnote ONLY — NOT heading/table/blockMath/questionItem,
//     where `id` is the real, preserved crossRef target id): footnote's
//     own `id` is a DERIVED "fn:N" display label, regenerated by the same
//     footnoteRules plugin; the real stable link is the separate
//     `"data-id"` attr, which — like heading/table/blockMath/questionItem's
//     `id` — genuinely round-trips exactly and is NOT stripped.
const DERIVED_ATTRS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  mermaid: ["svg"],
  functionPlot: ["svg"],
  statsChart: ["svg"],
  crossRef: ["resolvedKind", "resolvedValue", "broken"],
  questionBlank: ["resolvedValue", "broken"],
  blockMath: ["equationNumber"],
  footnoteReference: ["referenceNumber", "class", "href"],
  footnote: ["id"],
};

function stripTrustedDerivedAttrs(node: JSONContent): JSONContent {
  const clone: JSONContent = { ...node };
  if (clone.attrs) {
    const toStrip = DERIVED_ATTRS_BY_TYPE[clone.type ?? ""] ?? [];
    const attrs = { ...clone.attrs };
    for (const key of toStrip) delete attrs[key];
    clone.attrs = attrs;
  }
  if (clone.content) clone.content = clone.content.map(stripTrustedDerivedAttrs);
  return clone;
}

const SECRET_IMAGE_MARKERS = [
  "secret-caption-marker-1",
  "secret-caption-marker-2",
  "secret-caption-marker-3",
  "secret-row-caption-marker",
  "AAAAstandaloneimage",
  "BBBBrowimageone",
  "CCCCrowimagetwo",
];

const richDocumentV2: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1, id: "heading-intro" },
      content: [
        {
          type: "text",
          text: "Intro",
          marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }, { type: "strike" }, { type: "code" }],
        },
      ],
    },
    {
      type: "paragraph",
      attrs: { indent: 2 },
      content: [
        { type: "text", text: "Visit " },
        {
          type: "text",
          text: "AnvilNote",
          marks: [
            { type: "link", attrs: { href: "https://anvilnote.example", title: "Site", target: "_blank" } },
          ],
        },
        { type: "text", text: " colored", marks: [{ type: "textStyle", attrs: { color: "#336699" } }] },
        { type: "hardBreak" },
        { type: "inlineMath", attrs: { latex: "x^2" } },
        { type: "text", text: " heading:" },
        { type: "crossRef", attrs: { targetId: "heading-intro", resolvedKind: "heading", resolvedValue: "Intro", broken: false } },
        { type: "text", text: " table:" },
        { type: "crossRef", attrs: { targetId: "table-1", resolvedKind: "table", resolvedValue: "1", broken: false } },
        { type: "text", text: " eq:" },
        { type: "crossRef", attrs: { targetId: "eq-1", resolvedKind: "equation", resolvedValue: "1", broken: false } },
        { type: "text", text: " q:" },
        { type: "crossRef", attrs: { targetId: "question-1", resolvedKind: "question", resolvedValue: "1", broken: false } },
        { type: "text", text: " and " },
        { type: "footnoteReference", attrs: { "data-id": "fn-1", referenceNumber: "1", class: "footnote-ref", href: "#fn:1" } },
        { type: "text", text: " also " },
        { type: "questionBlank", attrs: { targetId: "question-1", resolvedValue: "1", broken: false } },
        { type: "text", text: " blank:" },
        { type: "inlineBlank" },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 3 },
      content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }] }],
    },
    {
      type: "bulletList",
      content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Bullet" }] }] }],
    },
    {
      type: "blockquote",
      attrs: { author: "Alan Turing", source: "On Computable Numbers" },
      content: [{ type: "paragraph", content: [{ type: "text", text: "Quote" }] }],
    },
    {
      type: "codeBlock",
      attrs: { language: "typescript" },
      content: [{ type: "text", text: "const x = 1;" }],
    },
    { type: "blockMath", attrs: { latex: "E=mc^2", id: "eq-1", equationNumber: "1", refName: "energy" } },
    { type: "horizontalRule", attrs: { thicknessPt: 1.5, lineStyle: "dashed" } },
    {
      type: "table",
      attrs: { id: "table-1", caption: "Values", variant: "three-line", align: "center" },
      content: [
        {
          type: "tableRow",
          attrs: { rowHeight: 42 },
          content: [
            {
              type: "tableHeader",
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: [160],
                fill: null,
                stroke: null,
                inset: null,
                breakable: null,
                verticalAlign: null,
              },
              content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
            },
            {
              type: "tableCell",
              attrs: {
                colspan: 2,
                rowspan: 1,
                colwidth: [80, 80],
                fill: null,
                stroke: null,
                inset: null,
                breakable: null,
                verticalAlign: null,
              },
              content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }],
            },
          ],
        },
      ],
    },
    {
      type: "callout",
      attrs: { kind: "tip", title: "Note", titleTouched: true },
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Callout body" }] },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Nested" }] }] }],
        },
        { type: "blockMath", attrs: { latex: "a+b", id: null, equationNumber: null, refName: null } },
        { type: "proof", content: [{ type: "paragraph", content: [{ type: "text", text: "Proof inside callout" }] }] },
        {
          type: "mermaid",
          attrs: { source: "flowchart LR\n  A-->B", theme: "base", primaryColor: "#ff0000", width: 80 },
        },
        {
          type: "image",
          attrs: {
            src: "data:image/png;base64,AAAAstandaloneimage",
            alt: null,
            title: null,
            caption: "secret-caption-marker-1",
            width: 50,
            align: "center",
            pdfSrc: null,
            originalSrc: null,
            id: null,
          },
        },
        {
          type: "imageRow",
          attrs: { caption: "secret-row-caption-marker", id: null },
          content: [
            {
              type: "image",
              attrs: {
                src: "data:image/png;base64,BBBBrowimageone",
                alt: null,
                title: null,
                caption: "secret-caption-marker-2",
                width: null,
                align: "center",
                pdfSrc: null,
                originalSrc: null,
                id: null,
              },
            },
            {
              type: "image",
              attrs: {
                src: "data:image/png;base64,CCCCrowimagetwo",
                alt: null,
                title: null,
                caption: "secret-caption-marker-3",
                width: null,
                align: "center",
                pdfSrc: null,
                originalSrc: null,
                id: null,
              },
            },
          ],
        },
        {
          type: "table",
          attrs: { id: null, caption: "", variant: "normal", align: "center" },
          content: [
            {
              type: "tableRow",
              attrs: { rowHeight: null },
              content: [
                {
                  type: "tableCell",
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    colwidth: null,
                    fill: null,
                    stroke: null,
                    inset: null,
                    breakable: null,
                    verticalAlign: null,
                  },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "nested table" }] }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "functionPlot",
      attrs: {
        curves: [{ formula: "x^2", color: "#ff0000", dash: "solid", thickness: 2 }],
        xMin: -5,
        xMax: 5,
        showGridlines: true,
        showAxisTicks: true,
        svg: "<svg>fake-function-plot</svg>",
      },
    },
    {
      type: "statsChart",
      attrs: {
        chartType: "column",
        data: [{ label: "A", value: 1, color: "#111111" }],
        seriesLabels: [],
        showLegend: true,
        showValues: true,
        showPercentage: "none",
        showGridLines: true,
        showBorder: true,
        xLabel: "X",
        yLabel: "Y",
        yLabelRotated: true,
        trendLine: "none",
        trendLineColor: "#E3120B",
        fontFamily: "sans",
        svg: "<svg>fake-stats-chart</svg>",
        caption: "chart-caption",
      },
    },
    {
      type: "question",
      content: [
        {
          type: "questionItem",
          attrs: {
            kind: "single",
            writtenMode: "lines",
            writtenLines: 3,
            writtenHeightPercent: 20,
            writtenHeightCm: null,
            multiForceOneColumn: true,
            stashedChoiceJSON: null,
            id: "question-1",
          },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Pick one" }] },
            {
              type: "choiceList",
              content: [
                { type: "choiceItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Choice A" }] }] },
                {
                  type: "choiceItem",
                  content: [{ type: "blockMath", attrs: { latex: "x=1", id: null, equationNumber: null, refName: null } }],
                },
              ],
            },
          ],
        },
        {
          type: "questionItem",
          attrs: {
            kind: "written",
            writtenMode: "blank",
            writtenLines: 3,
            writtenHeightPercent: 30,
            writtenHeightCm: 7.2,
            multiForceOneColumn: true,
            stashedChoiceJSON: null,
            id: null,
          },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Explain" }] }],
        },
      ],
    },
    {
      type: "footnotes",
      content: [
        {
          type: "footnote",
          attrs: { id: "fn:1", "data-id": "fn-1" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Footnote body" }] }],
        },
      ],
    },
  ],
};

describe("V2 AI edit snapshot converters (tiptapDocumentToAiSnapshotSource / aiSnapshotCandidateToTiptap)", () => {
  it("round-trips every registered non-image node type and mark losslessly, with images protected end to end", () => {
    const source = tiptapDocumentToAiSnapshotSource(richDocumentV2);
    const snapshot = buildEditSnapshot(source);

    // Images never enter the AI-facing payload: neither their data-URL
    // bytes nor their caption text appear anywhere in the sanitized
    // snapshot document.
    const serializedSnapshot = JSON.stringify(snapshot.document);
    for (const marker of SECRET_IMAGE_MARKERS) {
      expect(serializedSnapshot).not.toContain(marker);
    }

    const registry = createProtectedImageRegistry(snapshot.protectedImages);
    const restored = aiSnapshotCandidateToTiptap(snapshot.document, registry);

    expect(stripTrustedDerivedAttrs(restored)).toEqual(stripTrustedDerivedAttrs(richDocumentV2));
  });

  it("fails closed for an unknown mark type", () => {
    expect(() =>
      tiptapDocumentToAiSnapshotSource({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "highlight" }] }] },
        ],
      }),
    ).toThrow(AiSnapshotConversionError);
  });

  it("fails closed for an image inside a choiceItem (structurally impossible in the v2 AST)", () => {
    expect(() =>
      tiptapDocumentToAiSnapshotSource({
        type: "doc",
        content: [
          {
            type: "question",
            content: [
              {
                type: "questionItem",
                attrs: {
                  kind: "single",
                  writtenMode: "lines",
                  writtenLines: 3,
                  writtenHeightPercent: 20,
                  writtenHeightCm: null,
                  multiForceOneColumn: true,
                  stashedChoiceJSON: null,
                },
                content: [
                  { type: "paragraph", content: [] },
                  {
                    type: "choiceList",
                    content: [
                      { type: "choiceItem", content: [{ type: "image", attrs: { src: "x" } }] },
                      { type: "choiceItem", content: [{ type: "paragraph", content: [] }] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(AiSnapshotConversionError);
  });

  it("fails closed for a crossRef/questionBlank with no real target", () => {
    expect(() =>
      tiptapDocumentToAiSnapshotSource({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "crossRef", attrs: { targetId: null } }],
          },
        ],
      }),
    ).toThrow(AiSnapshotConversionError);
    expect(() =>
      tiptapDocumentToAiSnapshotSource({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "questionBlank", attrs: { targetId: null } }],
          },
        ],
      }),
    ).toThrow(AiSnapshotConversionError);
  });

  it("fails closed for an unresolved protected-image ref on restore", () => {
    const registry = createProtectedImageRegistry([]);
    expect(() =>
      aiSnapshotCandidateToTiptap(
        { type: "doc", content: [{ type: "protectedImage", ref: "n-missing" } as never] },
        registry,
      ),
    ).toThrow(AiSnapshotConversionError);
  });

  it("round-trips every statsChart data-union variant", () => {
    const variants: JSONContent[] = [
      {
        type: "statsChart",
        attrs: {
          chartType: "bar",
          data: [{ label: "A", value: 1, color: "#111111" }],
          seriesLabels: [],
          showLegend: true,
          showValues: true,
          showPercentage: "none",
          showGridLines: true,
          showBorder: true,
          xLabel: "X",
          yLabel: "Y",
          yLabelRotated: true,
          trendLine: "none",
          trendLineColor: "#E3120B",
          fontFamily: "sans",
          svg: null,
          caption: "",
        },
      },
      {
        type: "statsChart",
        attrs: {
          chartType: "column",
          data: [{ label: "A", value: 1 }],
          seriesLabels: [],
          showLegend: true,
          showValues: false,
          showPercentage: "none",
          showGridLines: true,
          showBorder: true,
          xLabel: "",
          yLabel: "",
          yLabelRotated: true,
          trendLine: "none",
          trendLineColor: "#E3120B",
          fontFamily: "sans",
          svg: null,
          caption: "",
        },
      },
      {
        type: "statsChart",
        attrs: {
          chartType: "stackedBar",
          data: [{ label: "A", values: [1, 2] }],
          seriesLabels: ["S1", "S2"],
          seriesColors: ["#111111", "#222222"],
          showLegend: true,
          showValues: false,
          showPercentage: "none",
          showGridLines: true,
          showBorder: true,
          xLabel: "X",
          yLabel: "Y",
          yLabelRotated: true,
          trendLine: "none",
          trendLineColor: "#E3120B",
          fontFamily: "sans",
          svg: null,
          caption: "",
        },
      },
      {
        type: "statsChart",
        attrs: {
          chartType: "stackedColumn",
          data: [{ label: "A", values: [1, 2] }],
          seriesLabels: ["S1", "S2"],
          showLegend: false,
          showValues: false,
          showPercentage: "none",
          showGridLines: true,
          showBorder: true,
          xLabel: "",
          yLabel: "",
          yLabelRotated: true,
          trendLine: "none",
          trendLineColor: "#E3120B",
          fontFamily: "sans",
          svg: null,
          caption: "",
        },
      },
      {
        type: "statsChart",
        attrs: {
          chartType: "line",
          data: [{ label: "A", value: 1 }],
          seriesLabels: [],
          showLegend: true,
          showValues: false,
          showPercentage: "none",
          showGridLines: true,
          showBorder: true,
          xLabel: "X",
          yLabel: "Y",
          yLabelRotated: true,
          trendLine: "none",
          trendLineColor: "#E3120B",
          fontFamily: "serif",
          svg: null,
          caption: "",
        },
      },
      {
        type: "statsChart",
        attrs: {
          chartType: "scatter",
          data: [{ x: 1, y: 2 }],
          seriesLabels: [],
          showLegend: true,
          showValues: false,
          showPercentage: "none",
          showGridLines: true,
          showBorder: true,
          xLabel: "X",
          yLabel: "Y",
          yLabelRotated: true,
          trendLine: "linear",
          trendLineColor: "#123456",
          fontFamily: "sans",
          svg: null,
          caption: "",
        },
      },
      {
        type: "statsChart",
        attrs: {
          chartType: "pie",
          data: [{ label: "A", value: 1 }],
          seriesLabels: [],
          showLegend: true,
          showValues: false,
          showPercentage: "onSlice",
          showGridLines: true,
          showBorder: true,
          xLabel: "",
          yLabel: "",
          yLabelRotated: true,
          trendLine: "none",
          trendLineColor: "#E3120B",
          fontFamily: "sans",
          svg: null,
          caption: "",
        },
      },
      {
        type: "statsChart",
        attrs: {
          chartType: "boxwhisker",
          data: [{ label: "A", min: 1, q1: 2, median: 3, q3: 4, max: 5 }],
          seriesLabels: [],
          showLegend: true,
          showValues: false,
          showPercentage: "none",
          showGridLines: true,
          showBorder: true,
          xLabel: "",
          yLabel: "",
          yLabelRotated: true,
          trendLine: "none",
          trendLineColor: "#E3120B",
          fontFamily: "sans",
          svg: null,
          caption: "",
        },
      },
    ];

    for (const chart of variants) {
      const doc: JSONContent = { type: "doc", content: [chart] };
      const source = tiptapDocumentToAiSnapshotSource(doc);
      const snapshot = buildEditSnapshot(source);
      const registry = createProtectedImageRegistry(snapshot.protectedImages);
      const restored = aiSnapshotCandidateToTiptap(snapshot.document, registry);
      expect(stripTrustedDerivedAttrs(restored)).toEqual(stripTrustedDerivedAttrs(doc));
    }
  });

  it("round-trips every table-cell style combination across a valid rowspan/colspan grid", () => {
    const tableDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          attrs: { id: null, caption: "", variant: "normal", align: "center" },
          content: [
            {
              type: "tableRow",
              attrs: { rowHeight: null },
              content: [
                {
                  type: "tableHeader",
                  attrs: {
                    colspan: 1,
                    rowspan: 2,
                    colwidth: [100],
                    fill: "#ffcc00",
                    stroke: "#003366",
                    inset: "4pt",
                    breakable: true,
                    verticalAlign: "middle",
                  },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "H1" }] }],
                },
                {
                  type: "tableHeader",
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    colwidth: [120],
                    fill: null,
                    stroke: null,
                    inset: null,
                    breakable: null,
                    verticalAlign: null,
                  },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "H2" }] }],
                },
              ],
            },
            {
              type: "tableRow",
              attrs: { rowHeight: null },
              content: [
                {
                  type: "tableCell",
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    colwidth: [120],
                    fill: null,
                    inset: null,
                    breakable: false,
                    verticalAlign: "bottom",
                    stroke: "#00ff00",
                  },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "C1" }] }],
                },
              ],
            },
          ],
        },
      ],
    };

    const source = tiptapDocumentToAiSnapshotSource(tableDoc);
    const snapshot = buildEditSnapshot(source);
    const registry = createProtectedImageRegistry(snapshot.protectedImages);
    const restored = aiSnapshotCandidateToTiptap(snapshot.document, registry);
    expect(stripTrustedDerivedAttrs(restored)).toEqual(stripTrustedDerivedAttrs(tableDoc));
  });
});
