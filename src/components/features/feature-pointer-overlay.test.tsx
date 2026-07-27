import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFeatureGuideStore } from "@/lib/stores/feature-guide-store";
import { FeaturePointerOverlay } from "./feature-pointer-overlay";

vi.mock("next-intl", () => ({
  useTranslations: () => (
    key: string,
    values?: Record<string, string>,
  ) => {
    if (key === "here") return `${values?.feature ?? ""} 在這裡`;
    if (key === "targetUnavailable") return "暫時無法顯示功能位置，請稍後再試。";
    return key;
  },
}));

function appendTarget(id: string): HTMLButtonElement {
  const target = document.createElement("button");
  target.dataset.featureId = id;
  target.getBoundingClientRect = () =>
    ({
      x: 120,
      y: 100,
      top: 100,
      right: 160,
      bottom: 132,
      left: 120,
      width: 40,
      height: 32,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(target);
  return target;
}

beforeEach(() => {
  useFeatureGuideStore.setState({ active: null });
});

afterEach(() => {
  document
    .querySelectorAll("[data-feature-id]")
    .forEach((element) => element.remove());
});

describe("FeaturePointerOverlay", () => {
  it("points to the active target and dismisses when the target is clicked", async () => {
    const target = appendTarget("editor.bold");
    useFeatureGuideStore.getState().start({
      requestId: 1,
      featureId: "editor.bold",
      label: "粗體",
      targetId: "editor.bold",
    });

    render(<FeaturePointerOverlay />);

    expect(await screen.findByRole("status")).toHaveTextContent("粗體 在這裡");
    fireEvent.click(target);

    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
  });

  it("replaces the current pointer and closes it with Escape", async () => {
    appendTarget("editor.bold");
    appendTarget("editor.italic");
    useFeatureGuideStore.getState().start({
      requestId: 1,
      featureId: "editor.bold",
      label: "粗體",
      targetId: "editor.bold",
    });
    render(<FeaturePointerOverlay />);
    expect(await screen.findByRole("status")).toHaveTextContent("粗體 在這裡");

    act(() => {
      useFeatureGuideStore.getState().start({
        requestId: 2,
        featureId: "editor.italic",
        label: "斜體",
        targetId: "editor.italic",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("斜體 在這裡");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
  });
});
