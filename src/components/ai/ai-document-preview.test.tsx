import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AIDocumentPreview } from "./ai-document-preview";

describe("AIDocumentPreview", () => {
  it("renders as embedded draft content without a nested card border", () => {
    const { container } = render(
      <AIDocumentPreview
        document={{
          schemaVersion: "anvilnote.document.v1",
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Embedded draft" }],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Embedded draft")).toBeInTheDocument();
    const preview = container.firstElementChild;
    expect(preview?.className).not.toContain("border");
    expect(preview?.className).not.toContain("rounded-lg");
  });

  it("renders callout, Proof/QED, and all native question structures safely", () => {
    const { container } = render(
      <AIDocumentPreview
        document={{
          schemaVersion: "anvilnote.document.v1",
          type: "doc",
          content: [
            {
              type: "callout",
              attrs: { kind: "tip", title: "Callout tip" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Highlighted note" }] }],
            },
            {
              type: "proof",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Proof argument" }] }],
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
                  },
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "Pick one" }] },
                    {
                      type: "choiceList",
                      content: [
                        { type: "choiceItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Choice A" }] }] },
                        { type: "choiceItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Choice B" }] }] },
                      ],
                    },
                  ],
                },
                {
                  type: "questionItem",
                  attrs: {
                    kind: "written",
                    writtenMode: "blank",
                    writtenLines: 5,
                    writtenHeightPercent: 30,
                    writtenHeightCm: null,
                    multiForceOneColumn: true,
                  },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Written response" }] }],
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Callout tip")).toBeInTheDocument();
    expect(screen.getByText("Highlighted note")).toBeInTheDocument();
    expect(screen.getByText("Proof argument")).toBeInTheDocument();
    expect(container.querySelector("[data-ai-preview-qed]")).toBeInTheDocument();
    expect(screen.getByText("Pick one")).toBeInTheDocument();
    expect(screen.getByText("Choice A")).toBeInTheDocument();
    expect(screen.getByText("Choice B")).toBeInTheDocument();
    expect(screen.getByText("Written response")).toBeInTheDocument();
    expect(container.querySelector("[data-ai-preview-written-answer]")).toBeInTheDocument();
  });
});
