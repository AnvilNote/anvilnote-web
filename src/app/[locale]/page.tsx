import { redirect } from "@/lib/i18n/navigation";
import type { AppLocale } from "@/lib/i18n/routing";

// This build has no landing/marketing page of its own (see anvilnote-doc) —
// the locale root just sends visitors to the real app entry point, matching
// the fixed boot route anvilnote-desktop/src/main/main.ts always loads.
export default async function RootPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  redirect({ href: "/documents", locale });
}
