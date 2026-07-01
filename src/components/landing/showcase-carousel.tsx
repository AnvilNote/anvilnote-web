"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type ShowcaseItem = {
  src: string;
  alt: string;
};

type ShowcaseCarouselProps = {
  items: ShowcaseItem[];
};

export function ShowcaseCarousel({ items }: ShowcaseCarouselProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [active, setActive] = useState(false);
  // Kept mounted (not conditionally rendered) after the first hover so the
  // scale/opacity transition always has a "from" state to animate out of —
  // an element can't transition on the same paint it first mounts in.
  const [focused, setFocused] = useState<ShowcaseItem | null>(items[0] ?? null);

  const activate = (item: ShowcaseItem) => {
    setIsPaused(true);
    setFocused(item);
    setActive(true);
  };
  const deactivate = () => {
    setIsPaused(false);
    setActive(false);
  };

  return (
    <div
      className="relative mt-10 overflow-x-hidden py-6"
      onMouseLeave={deactivate}
      onBlur={deactivate}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />

      {/* Rendered outside the (transformed) marquee track so `fixed` is
          relative to the viewport, not the animating track. */}
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-md transition-opacity duration-300 ease-out",
          active ? "opacity-100" : "opacity-0",
        )}
      >
        {focused ? (
          <div
            className={cn(
              "relative aspect-[4/5] w-[min(70vw,26rem)] shadow-2xl transition-transform duration-300 ease-out",
              active ? "scale-100" : "scale-90",
            )}
          >
            <Image
              src={focused.src}
              alt={focused.alt}
              fill
              sizes="70vw"
              className="object-cover object-top"
            />
          </div>
        ) : null}
      </div>

      <div
        className="landing-marquee-track showcase-marquee-track flex w-max items-center"
        style={{ animationPlayState: isPaused ? "paused" : "running" }}
      >
        {[0, 1].map((groupIndex) => (
          <div
            key={groupIndex}
            className="landing-marquee-group flex shrink-0 items-center gap-4 pr-4 whitespace-nowrap"
            aria-hidden={groupIndex === 1}
          >
            {items.map((item, index) => (
              <div
                key={`${groupIndex}-${item.src}`}
                className="w-[17rem] shrink-0"
                onMouseEnter={() => activate(item)}
                onFocus={() => activate(item)}
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-muted/70">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 1280px) 17rem, (min-width: 640px) 40vw, 80vw"
                    className="object-cover object-top"
                    priority={groupIndex === 0 && index < 2}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
