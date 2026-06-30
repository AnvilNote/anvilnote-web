import { defineRouting } from "next-intl/routing";

// Display + routing order. Default locale stays English regardless of order.
export const locales = ["zh-TW", "en", "ja", "ko", "th", "ru"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
});
