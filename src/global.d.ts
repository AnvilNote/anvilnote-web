import type messages from "../messages/en.json";
import type { locales } from "./lib/i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof locales)[number];
    Messages: typeof messages;
  }
}
