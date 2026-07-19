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
  const localizedAi = "ai" in messages && messages.ai && typeof messages.ai === "object"
    ? messages.ai
    : {};
  const localizedSmart = "smart" in localizedAi && localizedAi.smart && typeof localizedAi.smart === "object"
    ? localizedAi.smart
    : {};
  const localizedSettings = "settings" in localizedAi && localizedAi.settings && typeof localizedAi.settings === "object"
    ? localizedAi.settings
    : {};
  const localizedWritingStyle = "writingStyle" in localizedAi && localizedAi.writingStyle && typeof localizedAi.writingStyle === "object"
    ? localizedAi.writingStyle
    : {};

  return {
    locale,
    // Every locale inherits complete English Smart Mode copy, then overrides
    // the strings which have been reviewed in that locale.
    messages: {
      ...messages,
      ai: {
        ...englishMessages.ai,
        ...localizedAi,
        settings: {
          ...englishMessages.ai.settings,
          ...localizedSettings,
        },
        writingStyle: {
          ...englishMessages.ai.writingStyle,
          ...localizedWritingStyle,
        },
        smart: {
          ...englishMessages.ai.smart,
          ...localizedSmart,
        },
      },
    },
  };
});
