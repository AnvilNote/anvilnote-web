import { fireEvent, render, screen } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageBreakNodeView } from "./page-break-node-view";

vi.mock("@tiptap/react", async () => {
  const React = await import("react");

  return {
    NodeViewWrapper: ({
      as: Component = "div",
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      as?: React.ElementType;
      children?: React.ReactNode;
    }) => React.createElement(Component, props, children),
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    key === "pageBreakDelete" ? "刪除分頁" : key,
}));

describe("PageBreakNodeView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("centers the separator in the handle-height row and deletes itself", () => {
    const deleteNode = vi.fn();

    render(
      <PageBreakNodeView
        {...({
          node: { attrs: { weak: false } },
          deleteNode,
          selected: false,
        } as unknown as NodeViewProps)}
      />,
    );

    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-label",
      "#pagebreak()",
    );

    const deleteButton = screen.getByRole("button", { name: "刪除分頁" });
    fireEvent.mouseDown(deleteButton);
    fireEvent.click(deleteButton);

    expect(deleteNode).toHaveBeenCalledOnce();
  });
});
