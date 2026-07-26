import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inlineAIErrorMessageKey } from "./inline-error";

describe("inlineAIErrorMessageKey", () => {
  it("does not duplicate an API message key that is already fully qualified", () => {
    expect(inlineAIErrorMessageKey(new Error("ai.errors.provider_error"))).toBe(
      "ai.errors.provider_error",
    );
  });

  it("preserves every already-qualified ai.* message key", () => {
    expect(
      inlineAIErrorMessageKey(new Error("ai.edits.errors.invalid_edit_operation")),
    ).toBe("ai.edits.errors.invalid_edit_operation");
  });

  it("qualifies local error codes and safely handles unknown values", () => {
    expect(inlineAIErrorMessageKey(new Error("selection_conflict"))).toBe(
      "ai.errors.selection_conflict",
    );
    expect(inlineAIErrorMessageKey(null)).toBe("ai.errors.unknown_error");
  });

  it("defines safe localized messages for every stable edit error code", () => {
    const codes = [
      "invalid_edit_operation",
      "invalid_reference",
      "unsupported_image_edit",
      "request_too_large",
    ];
    for (const locale of ["en", "ja", "ko", "ru", "th", "zh-TW"]) {
      const messages = JSON.parse(
        readFileSync(resolve(process.cwd(), "messages", `${locale}.json`), "utf8"),
      ) as {
        ai?: { edits?: { errors?: Record<string, unknown> } };
      };
      for (const code of codes) {
        const message = messages.ai?.edits?.errors?.[code];
        expect(message, `${locale}: ${code}`).toEqual(expect.any(String));
        expect(String(message).trim().length, `${locale}: ${code}`).toBeGreaterThan(0);
        expect(message, `${locale}: ${code}`).not.toBe(code);
      }
    }
  });
});
