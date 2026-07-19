import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = (await import(`../../../messages/${locale}.json`)).default;
  const englishMessages = (await import("../../../messages/en.json")).default;

  return {
    locale,
    // Smart Mode launches with complete en and zh-TW translations. The
    // remaining existing locales use the English AI namespace until their
    // localized copy is reviewed, so no newly introduced key renders raw.
    messages: {
      ...messages,
      ai: "ai" in messages ? messages.ai : englishMessages.ai,
    },
  };
});
