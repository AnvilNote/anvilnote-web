"use client";

import { useMemo, type CSSProperties } from "react";
import type { ActiveHoliday } from "@/lib/holidays";

const PIECE_COUNT = 16;

interface Piece {
  Icon: ActiveHoliday["icons"][number];
  left: number;
  delay: number;
  duration: number;
  size: number;
  sway: number;
  swayDuration: number;
  swayPhase: number;
  rotate: number;
}

export function HolidayShower({ holiday }: { holiday: ActiveHoliday }) {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, index) => ({
        Icon: holiday.icons[index % holiday.icons.length],
        // Keep clear of both edges so a piece plus its sway never pokes
        // outside the viewport and gets clipped mid-fall.
        left: 1 + Math.random() * 95,
        // Top-to-bottom fall takes 1.8s, comfortably inside the overlay's 2s
        // lifetime (see CLEAR_AT_MS in quill-transition.tsx) with a small
        // stagger so pieces don't all start in lockstep.
        delay: Math.random() * 0.1,
        duration: 1.8,
        size: 20 + Math.random() * 16,
        // Small left/right sway while falling, not a wide swing. Each piece
        // gets its own oscillation rate and phase (negative delay) so the
        // shower never rocks in unison.
        sway: 8 + Math.random() * 10,
        swayDuration: 0.55 + Math.random() * 0.5,
        swayPhase: -Math.random() * 2,
        // Each piece settles into its own random tilt.
        rotate: (Math.random() - 0.5) * 140,
      })),
    [holiday],
  );

  return (
    <div className="holiday-shower pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map(({ Icon, ...piece }, index) => (
        <span
          key={index}
          className="holiday-shower-piece absolute top-0"
          style={
            {
              left: `${piece.left}%`,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              "--holiday-sway": `${piece.sway}px`,
              "--holiday-rotate": `${piece.rotate}deg`,
            } as CSSProperties
          }
        >
          <span
            className="holiday-shower-sway"
            style={{
              animationDuration: `${piece.swayDuration}s`,
              animationDelay: `${piece.swayPhase}s`,
            }}
          >
            <Icon width="100%" height="100%" />
          </span>
        </span>
      ))}
    </div>
  );
}
