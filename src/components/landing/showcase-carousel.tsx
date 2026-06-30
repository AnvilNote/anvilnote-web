"use client";

import Image from "next/image";
import { useState } from "react";

type ShowcaseItem = {
  src: string;
  alt: string;
};

type ShowcaseCarouselProps = {
  items: ShowcaseItem[];
};

export function ShowcaseCarousel({ items }: ShowcaseCarouselProps) {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div className="relative mt-10 overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />
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
                className="group/template showcase-marquee-item w-[17rem] shrink-0"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-muted/70">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 1280px) 17rem, (min-width: 640px) 40vw, 80vw"
                    className="object-cover object-top transition-transform duration-500 ease-out group-hover/template:scale-[1.015]"
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
