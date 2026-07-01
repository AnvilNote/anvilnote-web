"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Check } from "lucide-react";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { locales, type AppLocale } from "@/lib/i18n/routing";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/onboarding";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

// Splash always plays, every launch, and can't be skipped. The language and
// theme steps only run once ever (gated by hasSeenOnboarding), and only in
// the Electron desktop shell — never on the hosted web app or landing page.
const SPLASH_MS = 3000;
const FADE_MS = 300;

// Selecting a language calls router.replace(pathname, { locale }), which
// changes the [locale] route segment — next-intl's App Router remounts that
// whole layout (and this component) as part of the navigation. sessionStorage
// survives the remount, so it's how "resume straight at the theme step"
// survives losing all in-memory state; without it the effect below would see
// hasSeenOnboarding() still false and replay the splash from scratch.
const RESUME_KEY = "anvilnote.onboarding.resume";

type Phase = "pending" | "splash" | "language" | "theme" | "done";

export function FirstRunOnboarding() {
  const mounted = useMounted();
  const t = useTranslations();
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();

  const [phase, setPhase] = useState<Phase>("pending");
  const [visible, setVisible] = useState(false);
  const [firstRun, setFirstRun] = useState(false);
  // Defaults to "light" to match ThemeProvider's defaultTheme; picking a card
  // applies it live (setTheme below) so the user sees the real change.
  const [selectedTheme, setSelectedTheme] = useState<"light" | "dark">("light");
  // React's dev-mode Strict Mode invokes effects twice on mount to surface
  // non-idempotent side effects. Reading + deleting the resume flag is one of
  // those — without this guard, the second invocation sees it already gone
  // and falls through to re-deriving "splash", clobbering the resume.
  const initializedRef = useRef(false);

  // Resolve the desktop check and first-run flag once, after mount, so the
  // web app and landing page never render this at all.
  useEffect(() => {
    if (!mounted || initializedRef.current) return;
    initializedRef.current = true;
    if (!window.anvilnote) {
      setPhase("done");
      return;
    }
    if (window.sessionStorage.getItem(RESUME_KEY) === "theme") {
      window.sessionStorage.removeItem(RESUME_KEY);
      setPhase("theme");
      return;
    }
    setFirstRun(!hasSeenOnboarding());
    setPhase("splash");
  }, [mounted]);

  // Fade in every time the phase changes to a visible step — including the
  // very first appearance of the splash, and the fresh mount after the
  // locale-switch navigation resumes at "theme".
  useEffect(() => {
    if (phase === "pending" || phase === "done") return;
    setVisible(false);
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Splash: unconditional 3s, then fade into language (first run) or done.
  useEffect(() => {
    if (phase !== "splash") return;
    const timer = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => setPhase(firstRun ? "language" : "done"), FADE_MS);
    }, SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [phase, firstRun]);

  function selectLanguage(locale: AppLocale) {
    setVisible(false);
    window.setTimeout(() => {
      // If the user went Back and re-picks the locale that's already active
      // (e.g. re-confirming zh-TW), router.replace is a no-op — next-intl
      // won't remount, so the sessionStorage resume flag below would never
      // get consumed. Advance directly instead of waiting on a remount.
      if (locale === currentLocale) {
        setPhase("theme");
        return;
      }
      // The locale change below remounts this component; stash where to
      // resume so it lands on "theme" instead of replaying the splash.
      window.sessionStorage.setItem(RESUME_KEY, "theme");
      router.replace(pathname, { locale });
    }, FADE_MS);
  }

  // Applies immediately so the user can see the real theme change; only
  // Confirm actually finishes onboarding.
  function pickTheme(theme: "light" | "dark") {
    setSelectedTheme(theme);
    setTheme(theme);
  }

  function confirmTheme() {
    markOnboardingSeen();
    setVisible(false);
    window.setTimeout(() => setPhase("done"), FADE_MS);
  }

  // No navigation involved (locale is already set), so this is a plain
  // in-place phase change, unlike the forward language -> theme transition.
  function backToLanguage() {
    setVisible(false);
    window.setTimeout(() => setPhase("language"), FADE_MS);
  }

  if (!mounted || phase === "pending" || phase === "done") return null;

  return (
    // Backdrop is always fully opaque white the instant it's mounted — only
    // the content inside cross-fades between steps, so the app behind is
    // never visible through it, not even mid-transition.
    <div className="fixed inset-0 z-[100] bg-white">
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity ease-out"
        style={{ transitionDuration: `${FADE_MS}ms`, opacity: visible ? 1 : 0 }}
      >
        {phase === "splash" ? <SplashStep /> : null}
        {phase === "language" ? <LanguageStep onSelect={selectLanguage} /> : null}
        {phase === "theme" ? (
          <>
            <ThemeStep
              title={t("onboarding.chooseTheme")}
              lightLabel={t("settings.appearance.themeLight")}
              darkLabel={t("settings.appearance.themeDark")}
              selected={selectedTheme}
              onPick={pickTheme}
            />
            <button
              type="button"
              onClick={backToLanguage}
              className="absolute bottom-8 left-8 text-sm font-medium text-neutral-500 hover:text-neutral-900"
            >
              {t("onboarding.back")}
            </button>
            <button
              type="button"
              onClick={confirmTheme}
              className="absolute right-8 bottom-8 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
            >
              {t("onboarding.getStarted")}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SplashStep() {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-5">
      <Image src="/favicon-dark.svg" alt="" aria-hidden="true" width={96} height={96} className="size-24" />
      {/* h-24 matches the logo's size-24, so the two lines share its height. */}
      <div className="flex h-24 flex-col justify-center gap-1.5">
        <span className="text-5xl leading-none font-semibold tracking-tight text-neutral-900">
          AnvilNote
        </span>
        <span className="text-base text-neutral-500 italic">{t("app.tagline")}</span>
      </div>
    </div>
  );
}

function LanguageStep({ onSelect }: { onSelect: (locale: AppLocale) => void }) {
  const t = useTranslations();

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-8 px-6">
      <h1 className="text-xl font-semibold text-neutral-900">
        Choose your preferred language
      </h1>
      <div className="flex w-full flex-col gap-2">
        {locales.map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => onSelect(locale)}
            className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-900 hover:bg-neutral-50"
          >
            {t(`locale.${locale}` as never)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemeStep({
  title,
  lightLabel,
  darkLabel,
  selected,
  onPick,
}: {
  title: string;
  lightLabel: string;
  darkLabel: string;
  selected: "light" | "dark";
  onPick: (theme: "light" | "dark") => void;
}) {
  return (
    <div className="flex flex-col items-center gap-8 px-6">
      <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
      <div className="flex gap-6">
        <ThemePreviewCard
          variant="light"
          label={lightLabel}
          active={selected === "light"}
          onClick={() => onPick("light")}
        />
        <ThemePreviewCard
          variant="dark"
          label={darkLabel}
          active={selected === "dark"}
          onClick={() => onPick("dark")}
        />
      </div>
    </div>
  );
}

// Simplified mockup: a thin sidebar strip + a few line-placeholders standing
// in for editor text, colored per theme. No real screenshot asset needed.
function ThemePreviewCard({
  variant,
  label,
  active,
  onClick,
}: {
  variant: "light" | "dark";
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const isDark = variant === "dark";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2.5"
    >
      <span className="relative">
        <span
          className={cn(
            "flex h-28 w-40 overflow-hidden rounded-lg border-2 shadow-sm transition-colors",
            isDark ? "bg-neutral-900" : "bg-white",
            active ? "border-neutral-900" : "border-neutral-200 group-hover:border-neutral-400",
          )}
        >
          <span className={cn("h-full w-9 shrink-0", isDark ? "bg-neutral-800" : "bg-neutral-100")} />
          <span className="flex flex-1 flex-col justify-center gap-1.5 px-3">
            <span className={cn("h-1.5 w-3/4 rounded-full", isDark ? "bg-neutral-600" : "bg-neutral-300")} />
            <span className={cn("h-1.5 w-full rounded-full", isDark ? "bg-neutral-700" : "bg-neutral-200")} />
            <span className={cn("h-1.5 w-1/2 rounded-full", isDark ? "bg-neutral-700" : "bg-neutral-200")} />
          </span>
        </span>
        {active ? (
          <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-neutral-900 text-white">
            <Check className="size-3.5" />
          </span>
        ) : null}
      </span>
      <span className={cn("text-sm", active ? "font-semibold text-neutral-900" : "font-medium text-neutral-500")}>
        {label}
      </span>
    </button>
  );
}
