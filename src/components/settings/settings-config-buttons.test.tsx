import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { SettingsConfigButtons } from "./settings-config-buttons";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/settings-config", () => ({
  exportSettingsConfig: vi.fn(),
  importSettingsConfig: vi.fn(),
}));

describe("SettingsConfigButtons", () => {
  it("shows a success toast after exporting", async () => {
    const { exportSettingsConfig } = await import("@/lib/settings-config");
    vi.mocked(exportSettingsConfig).mockResolvedValueOnce(undefined as never);

    render(<SettingsConfigButtons />);
    await userEvent.click(screen.getByText("configExport"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("configExportSuccess"));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows an error toast when export fails", async () => {
    const { exportSettingsConfig } = await import("@/lib/settings-config");
    vi.mocked(exportSettingsConfig).mockRejectedValueOnce(new Error("boom"));

    render(<SettingsConfigButtons />);
    await userEvent.click(screen.getByText("configExport"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("configExportError"));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
