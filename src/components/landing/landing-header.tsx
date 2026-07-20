import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { LocaleSwitcher } from "@/components/app/locale-switcher";

export function LandingHeader() {
  return (
    // Fixed so it stays pinned while scrolling. Callers must reserve top
    // space (the landing hero uses pt-24+, legal pages a plain pt-24) since
    // this never participates in normal document flow.
    <header className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(72rem,calc(100%-2rem))] items-center justify-between gap-5 rounded-[1.7rem] border border-border/80 bg-background/88 px-5 py-3 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.26)] backdrop-blur lg:px-7">
      <Link href="/" className="flex items-center gap-2.5 text-2xl font-semibold tracking-[-0.04em]">
        <Image src="/favicon-dark.svg" alt="" width={36} height={36} className="size-9 dark:hidden" priority />
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

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
    </header>
  );
}
