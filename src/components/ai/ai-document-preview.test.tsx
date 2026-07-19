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
});
