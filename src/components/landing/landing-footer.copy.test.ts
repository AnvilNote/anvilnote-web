import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";
import ru from "../../../messages/ru.json";
import th from "../../../messages/th.json";
import zhTW from "../../../messages/zh-TW.json";

const messages = { en, "zh-TW": zhTW, ja, ko, ru, th };

describe("landing footer copy", () => {
  it("provides legal link labels in every supported locale", () => {
    for (const [locale, message] of Object.entries(messages)) {
      for (const key of ["privacy", "terms"] as const) {
        expect(message.landing.footer[key], `${locale} footer ${key} label`).toEqual(
          expect.any(String),
        );
        expect(message.landing.footer[key].trim(), `${locale} footer ${key} label`).not.toBe("");
      }
    }
  });
});
