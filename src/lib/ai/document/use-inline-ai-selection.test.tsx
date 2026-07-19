import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useInlineAISelection } from "./use-inline-ai-selection";

function SelectionHarness({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  useInlineAISelection(editor, { open, pending: false, range });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRange({ from: 1, to: 9 });
          setOpen(true);
        }}
      >
        Smart Mode
      </button>
      {open ? <textarea autoFocus aria-label="instruction" /> : null}
    </>
  );
}

describe("useInlineAISelection", () => {
  it("applies the selection decoration after the focused composer mounts", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "old text remains" }] }],
      },
    });
    render(<SelectionHarness editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Smart Mode" }));

    expect(screen.getByRole("textbox", { name: "instruction" })).toHaveFocus();
    expect(editor.view.dom.querySelector(".anvil-ai-inline-selection")?.textContent).toBe("old text");
    editor.destroy();
  });
});
