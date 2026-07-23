import { describe, expect, it } from "vitest";
import { applyDesktopUpdateStatus, type DesktopUpdateState } from "@/lib/desktop-update";

const base: DesktopUpdateState = {
  phase: "idle",
  version: null,
  downloadPercent: 0,
  errorMessage: null,
};

describe("applyDesktopUpdateStatus", () => {
  it("moves to checking and clears any previous error", () => {
    const prev = { ...base, phase: "error" as const, errorMessage: "boom" };
    expect(applyDesktopUpdateStatus(prev, { state: "checking" })).toEqual({
      ...prev,
      phase: "checking",
      errorMessage: null,
    });
  });

  it("records the available version", () => {
    expect(applyDesktopUpdateStatus(base, { state: "available", version: "0.1.19" })).toEqual({
      ...base,
      phase: "available",
      version: "0.1.19",
    });
  });

  it("moves to not-available", () => {
    expect(applyDesktopUpdateStatus(base, { state: "not-available" })).toEqual({
      ...base,
      phase: "not-available",
    });
  });

  it("tracks download percent while downloading", () => {
    expect(applyDesktopUpdateStatus(base, { state: "downloading", percent: 42 })).toEqual({
      ...base,
      phase: "downloading",
      downloadPercent: 42,
    });
  });

  it("records the downloaded version, ready to install", () => {
    expect(applyDesktopUpdateStatus(base, { state: "downloaded", version: "0.1.19" })).toEqual({
      ...base,
      phase: "downloaded",
      version: "0.1.19",
    });
  });

  it("records the error message", () => {
    expect(applyDesktopUpdateStatus(base, { state: "error", message: "network down" })).toEqual({
      ...base,
      phase: "error",
      errorMessage: "network down",
    });
  });

  it("ignores malformed or unrecognized payloads", () => {
    expect(applyDesktopUpdateStatus(base, null)).toEqual(base);
    expect(applyDesktopUpdateStatus(base, {})).toEqual(base);
    expect(applyDesktopUpdateStatus(base, { state: "not-a-real-state" })).toEqual(base);
  });
});
