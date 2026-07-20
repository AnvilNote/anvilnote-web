import { describe, expect, it } from "vitest";
import { parseAnvilNoteRuntime } from "./runtime";

describe("parseAnvilNoteRuntime", () => {
  it("parses public-web", () => {
    expect(parseAnvilNoteRuntime("public-web")).toBe("public-web");
  });

  it("parses desktop", () => {
    expect(parseAnvilNoteRuntime("desktop")).toBe("desktop");
  });

  it("defaults missing value to desktop in development", () => {
    expect(parseAnvilNoteRuntime(undefined, { nodeEnv: "development" })).toBe("desktop");
    expect(parseAnvilNoteRuntime("", { nodeEnv: "development" })).toBe("desktop");
  });

  it("throws when missing in production", () => {
    expect(() => parseAnvilNoteRuntime(undefined, { nodeEnv: "production" })).toThrow(
      /NEXT_PUBLIC_ANVILNOTE_RUNTIME is not set/,
    );
  });

  it("throws when missing and nodeEnv is unset entirely", () => {
    expect(() => parseAnvilNoteRuntime(undefined, { nodeEnv: undefined })).toThrow(
      /NEXT_PUBLIC_ANVILNOTE_RUNTIME is not set/,
    );
  });

  it("throws on an invalid value", () => {
    expect(() => parseAnvilNoteRuntime("staging")).toThrow(/invalid value/);
  });

  it("throws on an invalid value even in development", () => {
    expect(() => parseAnvilNoteRuntime("staging", { nodeEnv: "development" })).toThrow(
      /invalid value/,
    );
  });
});
