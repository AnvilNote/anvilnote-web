"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "@/lib/i18n/navigation";
import { useTransitionStore } from "@/lib/stores/transition-store";
import { getRandomQuote } from "@/lib/quotes";

const NAVIGATE_AT_MS = 950;
const CLEAR_AT_MS = 1700;

// Matches the document editor route (a doc is open), e.g. /en/documents/abc123.
const EDITOR_ROUTE = /\/documents\/[^/]+/;

export function QuillTransition() {
  const router = useRouter();
  const playing = useTransitionStore((s) => s.playing);
  const to = useTransitionStore((s) => s.to);
  const play = useTransitionStore((s) => s.play);
  const clear = useTransitionStore((s) => s.clear);

  // Pick a fresh quote each time the overlay starts playing.
  const quote = useMemo(() => (playing ? getRandomQuote() : null), [playing]);

  // This component lives in the root layout, so it only mounts on a full page
  // load (reload / direct URL) — never on client-side navigation. Play the
  // transition when such a load lands in the editor.
  useEffect(() => {
    if (typeof window !== "undefined" && EDITOR_ROUTE.test(window.location.pathname)) {
      play();
    }
  }, [play]);

  useEffect(() => {
    if (!playing) return;
    const navigateTimer = to
      ? window.setTimeout(() => router.push(to), NAVIGATE_AT_MS)
      : undefined;
    const clearTimer = window.setTimeout(() => clear(), CLEAR_AT_MS);
    return () => {
      if (navigateTimer) window.clearTimeout(navigateTimer);
      window.clearTimeout(clearTimer);
    };
  }, [playing, to, router, clear]);

  if (!playing) return null;

  return (
    <div className="quill-transition-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      <span className="quill-enter relative z-10 -mt-16 inline-flex">
        <span className="quill-swing inline-flex">
          <Image
            src="/quill-dark.svg"
            alt=""
            aria-hidden="true"
            width={112}
            height={112}
            priority
            className="size-28 dark:hidden"
          />
          <Image
            src="/quill-white.svg"
            alt=""
            aria-hidden="true"
            width={112}
            height={112}
            priority
            className="hidden size-28 dark:block"
          />
        </span>
      </span>

      {quote ? (
        <figure className="quill-quote mt-10 w-full max-w-md px-6">
          <blockquote className="text-balance text-center text-lg leading-relaxed text-foreground italic">
            “{quote.content}”
          </blockquote>
          <figcaption className="mt-3 text-right text-sm text-muted-foreground">
            — {quote.author}
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}
