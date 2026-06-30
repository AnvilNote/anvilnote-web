import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/lib/i18n/routing";
import { Link } from "@/lib/i18n/navigation";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { LandingDemoEditor } from "@/components/landing/landing-demo-editor";
import { HeroParticles } from "@/components/landing/hero-particles";
import { ShowcaseCarousel } from "@/components/landing/showcase-carousel";
import { Button } from "@/components/ui/button";

type LandingCopy = {
  heroLabel: string;
  heroLine1: string;
  heroLine2Before: string;
  heroHighlight: string;
  heroLine2After: string;
  heroLine3: string;
  heroKicker: string;
  heroDescription: string;
  cta: string;
  secondaryCta: string;
  navLinks?: string[];
  showcaseTitle: string;
  showcaseDescription: string;
  closingTitle: string;
  closingDescription: string;
  closingCta: string;
  demo: {
    search: string;
    documents: string;
    currentLabel: string;
    appName: string;
    documentsNav: string;
    templates: string;
    settings: string;
    save: string;
    export: string;
    exportDisabled: string;
    outline: string;
    metadata: string;
    template: string;
    exportTab: string;
    starterTitle: string;
  };
};

const showcaseItems = [
  { src: "/landing/plain-note.png", alt: "Plain Note template preview" },
  { src: "/landing/flow-way.png", alt: "Flow Way template preview" },
  { src: "/landing/bubble.png", alt: "Bubble template preview" },
  { src: "/landing/hetvid.png", alt: "Hetvid template preview" },
];

const techStack = [
  { name: "Next.js", src: "/tech-logos/nextdotjs.svg", width: 110, height: 22 },
  { name: "React", src: "/tech-logos/react.svg", width: 92, height: 22 },
  { name: "Tiptap", src: "/tech-logos/tiptap.png", width: 28, height: 28 },
  { name: "TypeScript", src: "/tech-logos/typescript.svg", width: 126, height: 24 },
  { name: "Tailwind CSS", src: "/tech-logos/tailwindcss.svg", width: 142, height: 18 },
  { name: "shadcn/ui", src: "/tech-logos/shadcnui.svg", width: 112, height: 22 },
  { name: "Radix UI", src: "/tech-logos/radixui.svg", width: 110, height: 20 },
  { name: "Typst", src: "/tech-logos/typst.svg", width: 90, height: 22 },
];

export default async function LocaleIndexPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  const copy: LandingCopy = {
    heroLabel: t("hero.label"),
    heroLine1: t("hero.line1"),
    heroLine2Before: t("hero.line2Before"),
    heroHighlight: t("hero.highlight"),
    heroLine2After: t("hero.line2After"),
    heroLine3: t("hero.line3"),
    heroKicker: t("hero.kicker"),
    heroDescription: t("hero.description"),
    cta: t("hero.cta"),
    secondaryCta: t("hero.secondaryCta"),
    // navLinks: [t("nav.product"), t("nav.templates"), t("nav.guide")],
    showcaseTitle: t("showcase.title"),
    showcaseDescription: t("showcase.description"),
    closingTitle: t("closing.title"),
    closingDescription: t("closing.description"),
    closingCta: t("closing.cta"),
    demo: {
      search: t("demo.search"),
      documents: t("demo.documents"),
      currentLabel: t("demo.currentLabel"),
      appName: t("demo.appName"),
      documentsNav: t("demo.documentsNav"),
      templates: t("demo.templates"),
      settings: t("demo.settings"),
      save: t("demo.save"),
      export: t("demo.export"),
      exportDisabled: t("demo.exportDisabled"),
      outline: t("demo.outline"),
      metadata: t("demo.metadata"),
      template: t("demo.template"),
      exportTab: t("demo.exportTab"),
      starterTitle: t("demo.starterTitle"),
    },
  };

  return (
    <div className="bg-background text-foreground">
      {/* Fixed so it stays pinned while scrolling. Lifted out of the hero
          <section> because that section is overflow-hidden (for the particle
          canvas), which would otherwise clip a sticky header out of view. */}
      <header className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(72rem,calc(100%-2rem))] items-center justify-between gap-5 rounded-[1.7rem] border border-border/80 bg-background/88 px-5 py-3 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.26)] backdrop-blur lg:px-7">
        <Link href="/" className="flex items-center gap-2.5 text-2xl font-semibold tracking-[-0.04em]">
          <Image
            src="/favicon-dark.svg"
            alt=""
            width={36}
            height={36}
            className="size-9 dark:hidden"
            priority
          />
          <Image
            src="/favicon-light.svg"
            alt=""
            width={36}
            height={36}
            className="hidden size-9 dark:block"
            priority
          />
          <span>AnvilNote</span>
        </Link>

        {/* Nav links hidden for now — re-enable when the destination pages exist.
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 text-sm text-foreground/78 lg:flex">
          {copy.navLinks.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </nav>
        */}

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
          <Button asChild variant="outline" size="lg" className="hidden rounded-2xl px-4 text-sm md:inline-flex">
            <Link href="#demo">{copy.secondaryCta}</Link>
          </Button>
          <Button asChild size="lg" className="rounded-2xl px-4 text-sm">
            <Link href="/documents">{copy.cta}</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <HeroParticles />
          <div className="relative mx-auto w-full max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
            <div className="px-1 pt-24 pb-16 text-center lg:pt-32 lg:pb-18">
              <div className="mx-auto max-w-6xl text-[3.2rem] leading-[0.93] font-semibold tracking-[-0.08em] sm:text-[4.6rem] lg:text-[6.4rem]">
                <div>{copy.heroLine1}</div>
                <div>
                  {copy.heroLine2Before ? <>{copy.heroLine2Before} </> : null}
                  <span className="inline-block bg-foreground px-[0.2em] py-[0.06em] text-background">
                    {copy.heroHighlight}
                  </span>
                  {copy.heroLine2After ? <> {copy.heroLine2After}</> : null}
                </div>
                <div>{copy.heroLine3}</div>
              </div>
              <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-foreground/76">
                {copy.heroKicker}
              </p>
              <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                {copy.heroDescription}
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="h-11 rounded-full px-6">
                  <Link href="/documents">{copy.cta}</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-6">
                  <Link href="#demo">{copy.secondaryCta}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="demo" className="px-6 pt-2 pb-8 lg:px-10 lg:pt-4 lg:pb-10">
          <div className="mx-auto w-full max-w-7xl">
            <LandingDemoEditor copy={copy.demo} />
          </div>
        </section>

        <section className="py-7 lg:py-9">
          <div className="relative mx-auto w-full max-w-7xl overflow-hidden px-6 lg:px-10">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent" />
            <div className="landing-marquee-track flex w-max items-center">
              {[0, 1].map((groupIndex) => (
                <div
                  key={groupIndex}
                  className="landing-marquee-group flex shrink-0 items-center gap-5 pr-5 whitespace-nowrap"
                  aria-hidden={groupIndex === 1}
                >
                  {techStack.map((item) => (
                    <div
                      key={`${groupIndex}-${item.name}`}
                      className="flex min-h-28 min-w-[9.5rem] flex-col items-center justify-center gap-3 rounded-[1.5rem] px-6 py-4"
                    >
                      <div className="flex h-20 items-center justify-center">
                        {item.src ? (
                          <Image
                            src={item.src}
                            alt={item.name}
                            width={item.width}
                            height={item.height}
                            className="h-14 w-auto object-contain"
                            unoptimized
                          />
                        ) : (
                          <span className="text-[2rem] leading-none font-semibold tracking-[-0.06em] text-foreground">
                            {item.name}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium tracking-[-0.02em] text-muted-foreground">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/70">
          <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-12">
            <div className="max-w-2xl">
              <p className="text-[0.68rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                {copy.showcaseTitle}
              </p>
              <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">
                {copy.showcaseDescription}
              </p>
            </div>

            <ShowcaseCarousel items={showcaseItems} />
          </div>
        </section>

        <section>
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-16 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-4xl leading-tight font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                {copy.closingTitle}
              </p>
              <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
                {copy.closingDescription}
              </p>
            </div>

            <Button asChild size="lg" className="h-11 rounded-full px-6">
              <Link href="/documents">{copy.closingCta}</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
