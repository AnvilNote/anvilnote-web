import { redirect } from "@/lib/i18n/navigation";
import type { AppLocale } from "@/lib/i18n/routing";

export default async function LocaleIndexPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  redirect({ href: "/documents", locale });
}
