import { act, render, screen } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { describe, expect, it, vi } from "vitest";
import { BlockHandle } from "./block-handle";

const dragHandleState = vi.hoisted(() => ({
  onNodeChange: null as
    | ((data: { node: PMNode | null; pos: number }) => void)
    | null,
}));

vi.mock("@tiptap/extension-drag-handle-react", () => ({
  DragHandle: ({
    className,
    onNodeChange,
    children,
  }: {
    className: string;
    onNodeChange: (data: { node: PMNode | null; pos: number }) => void;
    children: React.ReactNode;
  }) => {
    dragHandleState.onNodeChange = onNodeChange;
    return (
      <div data-testid="drag-handle" className={className}>
        {children}
      </div>
    );
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => () => "拖曳區塊",
}));

describe("BlockHandle", () => {
  it("moves farther left only for list items", () => {
    render(<BlockHandle editor={{} as Editor} />);

    act(() => {
      dragHandleState.onNodeChange?.({
        node: { type: { name: "listItem" } } as PMNode,
        pos: 1,
      });
    });
    expect(screen.getByTestId("drag-handle")).toHaveClass(
      "anvil-drag-handle--list",
    );

    act(() => {
      dragHandleState.onNodeChange?.({
        node: { type: { name: "paragraph" } } as PMNode,
        pos: 1,
      });
    });
    expect(screen.getByTestId("drag-handle")).not.toHaveClass(
      "anvil-drag-handle--list",
    );
  });

  it("sets a wider offset for a wider marker than for a narrow one", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const li = document.createElement("li");
    container.appendChild(li);

    // jsdom has no real canvas 2d context, so measureText always reports 0
    // width regardless of the string — fake one whose width scales with
    // string length, closely mirroring how a real font actually behaves.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      measureText: (text: string) => ({ width: text.length * 10 }),
    } as unknown as CanvasRenderingContext2D);

    const editor = {
      view: {
        dom: { parentElement: container },
        nodeDOM: () => li,
      },
    } as unknown as Editor;
    render(<BlockHandle editor={editor} />);

    li.setAttribute("data-list-marker", "•");
    act(() => {
      dragHandleState.onNodeChange?.({
        node: { type: { name: "listItem" } } as PMNode,
        pos: 1,
      });
    });
    const narrowOffset = container.style.getPropertyValue(
      "--anvil-drag-handle-list-offset",
    );

    li.setAttribute("data-list-marker", "viii.");
    act(() => {
      dragHandleState.onNodeChange?.({
        node: { type: { name: "paragraph" } } as PMNode,
        pos: 1,
      });
    });
    act(() => {
      dragHandleState.onNodeChange?.({
        node: { type: { name: "listItem" } } as PMNode,
        pos: 1,
      });
    });
    const wideOffset = container.style.getPropertyValue(
      "--anvil-drag-handle-list-offset",
    );

    expect(narrowOffset).toBe("-26px");
    expect(wideOffset).toBe("-66px");

    container.remove();
    vi.restoreAllMocks();
  });
});
