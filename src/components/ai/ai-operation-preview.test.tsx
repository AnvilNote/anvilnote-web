import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OperationPreviewModel } from "@/lib/ai/document/operation-preview";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

import { AiOperationPreview } from "./ai-operation-preview";

function baseModel(overrides: Partial<OperationPreviewModel> = {}): OperationPreviewModel {
  return {
    cards: [
      {
        operationIndex: 0,
        action: "replaceText",
        nodeType: "text",
        before: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Old" }] }] },
        after: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "New" }] }] },
      },
    ],
    ...overrides,
  };
}

describe("AiOperationPreview", () => {
  it("renders one card per operation with an Accept and a Reject control", () => {
    render(
      <AiOperationPreview model={baseModel()} disabled={false} onAccept={vi.fn()} onReject={vi.fn()} />,
    );

    expect(screen.getAllByTestId("ai-operation-card")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "smart.accept" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "smart.reject" })).toBeEnabled();
  });

  it("calls the provided stub handlers when Accept/Reject are clicked", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(<AiOperationPreview model={baseModel()} disabled={false} onAccept={onAccept} onReject={onReject} />);

    fireEvent.click(screen.getByRole("button", { name: "smart.accept" }));
    fireEvent.click(screen.getByRole("button", { name: "smart.reject" }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("disables Accept and Reject while another turn is in flight", () => {
    render(<AiOperationPreview model={baseModel()} disabled onAccept={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByRole("button", { name: "smart.accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "smart.reject" })).toBeDisabled();
  });

  it("shows a translated label for every one of the six operation action kinds", () => {
    const model: OperationPreviewModel = {
      cards: [
        { operationIndex: 0, action: "insertNode", nodeType: "paragraph", before: null, after: { type: "doc", content: [{ type: "paragraph" }] } },
        { operationIndex: 1, action: "replaceNode", nodeType: "paragraph", before: { type: "doc", content: [{ type: "paragraph" }] }, after: { type: "doc", content: [{ type: "paragraph" }] } },
        { operationIndex: 2, action: "deleteNode", nodeType: "paragraph", before: { type: "doc", content: [{ type: "paragraph" }] }, after: null },
        { operationIndex: 3, action: "moveNode", nodeType: "paragraph", before: { type: "doc", content: [{ type: "paragraph" }] }, after: { type: "doc", content: [{ type: "paragraph" }] } },
        { operationIndex: 4, action: "updateAttrs", nodeType: "heading", before: { type: "doc", content: [{ type: "heading", attrs: { level: 1 } }] }, after: { type: "doc", content: [{ type: "heading", attrs: { level: 2 } }] } },
        { operationIndex: 5, action: "replaceText", nodeType: "text", before: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] }, after: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] } },
      ],
    };
    render(<AiOperationPreview model={model} disabled={false} onAccept={vi.fn()} onReject={vi.fn()} />);

    for (const action of ["insertNode", "replaceNode", "deleteNode", "moveNode", "updateAttrs", "replaceText"]) {
      expect(screen.getByText(`smart.operationLabels.${action}`)).toBeInTheDocument();
    }
  });

  it("shows before then after, in that order, within each card", () => {
    render(<AiOperationPreview model={baseModel()} disabled={false} onAccept={vi.fn()} onReject={vi.fn()} />);

    const card = screen.getByTestId("ai-operation-card");
    const text = card.textContent ?? "";
    expect(text.indexOf("smart.before")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("smart.before")).toBeLessThan(text.indexOf("smart.after"));
  });

  it("renders a mermaid before/after fragment through the real mermaid NodeView, not raw HTML", () => {
    const model: OperationPreviewModel = {
      cards: [
        {
          operationIndex: 0,
          action: "updateAttrs",
          nodeType: "mermaid",
          before: { type: "doc", content: [{ type: "mermaid", attrs: { source: "graph TD; A-->B", theme: "default" } }] },
          after: { type: "doc", content: [{ type: "mermaid", attrs: { source: "graph TD; A-->B-->C", theme: "default" } }] },
        },
      ],
    };
    const { container } = render(
      <AiOperationPreview model={model} disabled={false} onAccept={vi.fn()} onReject={vi.fn()} />,
    );

    expect(container.querySelectorAll('[data-type="mermaid"]')).toHaveLength(2);
  });

  it("never feeds a dangerouslySetInnerHTML sink directly from model-authored node data", () => {
    // This module's own markup never interpolates card.before/card.after
    // content as raw HTML anywhere itself (mermaid's own NodeView renders
    // its OWN internally-computed SVG from the trusted `mermaid` package,
    // never from anything the model supplies directly — verified in
    // mermaid-node-view.tsx). Guard the html shape this component produces
    // for a functionPlot/statsChart svg attr some future change might
    // otherwise leak: the "after" attrs are exactly what's in the model,
    // and this component never reads `.svg` off a card's content at all.
    const model: OperationPreviewModel = {
      cards: [
        {
          operationIndex: 0,
          action: "updateAttrs",
          nodeType: "functionPlot",
          before: null,
          after: {
            type: "doc",
            content: [{
              type: "functionPlot",
              attrs: {
                curves: [{ formula: "x", color: "#000000", dash: "solid", thickness: 2 }],
                xMin: -10,
                xMax: 10,
                showGridlines: true,
                showAxisTicks: true,
                svg: "<svg><script>alert(1)</script></svg>",
              },
            }],
          },
        },
      ],
    };
    const { container } = render(
      <AiOperationPreview model={model} disabled={false} onAccept={vi.fn()} onReject={vi.fn()} />,
    );

    expect(container.innerHTML).not.toContain("alert(1)");
  });

  it("shows a placeholder instead of an editor for a null before/after fragment", () => {
    const model: OperationPreviewModel = {
      cards: [
        { operationIndex: 0, action: "insertNode", nodeType: "paragraph", before: null, after: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "New" }] }] } },
      ],
    };
    render(<AiOperationPreview model={model} disabled={false} onAccept={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByText("smart.emptyFragment")).toBeInTheDocument();
    expect(within(screen.getByTestId("ai-operation-card")).getByText("New")).toBeInTheDocument();
  });
});
