import { describe, expect, it } from "vitest";
import { inlineAIErrorMessageKey } from "./inline-error";

describe("inlineAIErrorMessageKey", () => {
  it("does not duplicate an API message key that is already fully qualified", () => {
    expect(inlineAIErrorMessageKey(new Error("ai.errors.provider_error"))).toBe(
      "ai.errors.provider_error",
    );
  });

  it("qualifies local error codes and safely handles unknown values", () => {
    expect(inlineAIErrorMessageKey(new Error("selection_conflict"))).toBe(
      "ai.errors.selection_conflict",
    );
    expect(inlineAIErrorMessageKey(null)).toBe("ai.errors.unknown_error");
  });
});
