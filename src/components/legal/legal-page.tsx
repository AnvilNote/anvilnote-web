import ReactMarkdown from "react-markdown";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

export function LegalPage({
  backHome,
  footerRights,
  footerPrivacy,
  footerTerms,
  markdown,
}: {
  backHome: string;
  footerRights: string;
  footerPrivacy: string;
  footerTerms: string;
  markdown: string;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <LandingHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-32 pb-16 lg:px-0">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {backHome}
        </Link>

        <div className="mt-6">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-balance">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="mt-10 text-xl font-semibold tracking-[-0.02em]">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-6 text-base font-semibold tracking-[-0.01em]">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="mt-3 text-base leading-8 text-muted-foreground first:mt-2">{children}</p>
              ),
              ol: ({ children }) => (
                <ol className="mt-3 list-decimal space-y-1 pl-6 text-base leading-8 text-muted-foreground">
                  {children}
                </ol>
              ),
              ul: ({ children }) => (
                <ul className="mt-3 list-disc space-y-1 pl-6 text-base leading-8 text-muted-foreground">
                  {children}
                </ul>
              ),
              li: ({ children }) => <li className="pl-1">{children}</li>,
              em: ({ children }) => <span className="text-sm text-muted-foreground">{children}</span>,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </main>

      <LandingFooter
        rights={footerRights}
        privacy={footerPrivacy}
        terms={footerTerms}
      />
    </div>
  );
}
