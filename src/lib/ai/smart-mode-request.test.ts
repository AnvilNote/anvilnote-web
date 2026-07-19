import { describe, expect, it } from "vitest";
import { deriveWriterIntent } from "./smart-mode-request";

describe("Smart Mode intent detection", () => {
  it("uses compose for an instruction without selection or attachments", () => {
    expect(deriveWriterIntent(false, 0)).toBe("compose");
  });

  it("uses attachment composition only when there is no selection", () => {
    expect(deriveWriterIntent(false, 1)).toBe("compose-from-attachments");
    expect(deriveWriterIntent(true, 1)).toBe("rewrite-selection");
  });

  it("always rewrites a present selection", () => {
    expect(deriveWriterIntent(true, 0)).toBe("rewrite-selection");
  });
});
