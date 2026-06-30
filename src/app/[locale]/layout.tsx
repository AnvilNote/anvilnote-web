import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/lib/i18n/routing";
import { StoreHydrator } from "@/components/app/store-hydrator";
import { AppShell } from "@/components/app/app-shell";
import { ThemeFavicon } from "@/components/app/theme-favicon";
import { ThemeProvider } from "@/components/app/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AnvilNote",
  description: "A minimalist editor for forging beautiful lecture notes.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script
          // Apply the persisted theme before first paint to avoid a flash.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark';var c=document.documentElement.classList;var h=d?'/favicon-light.svg':'/favicon-dark.svg';var q=function(r){var l=document.querySelector("link[rel='"+r+"']");if(!l){l=document.createElement('link');l.rel=r;document.head.appendChild(l)}l.href=h;l.type='image/svg+xml'};if(d){c.add('dark')}else{c.remove('dark')}document.documentElement.style.colorScheme=d?'dark':'light';q('icon');q('shortcut icon')}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className="min-h-full bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <ThemeFavicon />
            <StoreHydrator>
              <AppShell>{children}</AppShell>
            </StoreHydrator>
            <Toaster
              position="top-right"
              expand
              closeButton
              duration={3000}
              gap={12}
              offset={{ top: "64px", right: "16px" }}
            />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
