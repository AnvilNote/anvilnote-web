import { defineRouting } from "next-intl/routing";

// Display + routing order. Default locale stays English regardless of order.
export const locales = ["zh-TW", "en", "ja", "ko", "th", "ru"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  // next-intl's default NEXT_LOCALE cookie has no maxAge (session cookie).
  // The desktop app is Electron/Chromium, which clears session cookies on
  // quit — so a chosen locale silently reverted to the OS's Accept-Language
  // on every relaunch instead of staying picked. One year, so it survives
  // restarts like any real preference should.
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365,
  },
});
