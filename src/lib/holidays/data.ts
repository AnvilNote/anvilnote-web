import {
  Bat,
  Canoe,
  ChristmasTree,
  ConfettiBall,
  Dragon,
  EarOfCorn,
  Egg,
  FallenLeaf,
  Firecracker,
  FourLeafClover,
  FullMoon,
  Ghost,
  JackOLantern,
  MoonCake,
  PartyPopper,
  RabbitFace,
  RedEnvelope,
  RedHeart,
  Rose,
  Shamrock,
  Snowflake,
  Sparkles,
  Turkey,
  TwoHearts,
  WrappedGift,
} from "@/components/icons/twemoji";
import type { HolidayConfig } from "./index";

// Lunar/solar holiday dates shift year to year, so floating holidays only
// list the years below — add a new occurrence row for each future year as it
// comes up. Fixed holidays need no such upkeep; they recur on the same
// month/day forever.
//
// Floating dates below (2026-2028) are sourced from web search against real
// calendars (Chinese lunar calendar conversions, US Thanksgiving, Easter
// tables) — see conversation for sources. Add 2029+ rows as those years
// approach.
export const HOLIDAYS: HolidayConfig[] = [
  {
    id: "new-year",
    kind: "fixed",
    month: 1,
    day: 1,
    spanDays: 1,
    icons: [PartyPopper, ConfettiBall, Sparkles],
    // Party popper artwork is drawn on its own diagonal, same situation as
    // the firecracker — this starting angle is a guess, needs the same kind
    // of visual tuning firecracker got.
    hat: { Icon: PartyPopper, deg: -30 },
  },
  {
    id: "lunar-new-year",
    kind: "floating",
    occurrences: [
      { year: 2026, start: "2026-02-14", end: "2026-02-23" },
      { year: 2027, start: "2027-02-03", end: "2027-02-12" },
      { year: 2028, start: "2028-01-23", end: "2028-02-01" },
    ],
    icons: [RedEnvelope, Firecracker, Sparkles],
    hat: { Icon: Firecracker, deg: -30 },
  },
  {
    id: "valentines-day",
    kind: "fixed",
    month: 2,
    day: 14,
    spanDays: 1,
    icons: [RedHeart, TwoHearts, Rose],
    hat: { Icon: RedHeart, deg: 10 },
  },
  {
    id: "st-patricks-day",
    kind: "fixed",
    month: 3,
    day: 17,
    spanDays: 1,
    icons: [FourLeafClover, Shamrock],
    hat: { Icon: Shamrock, deg: 10 },
  },
  {
    id: "easter",
    kind: "floating",
    occurrences: [
      { year: 2026, start: "2026-04-03", end: "2026-04-06" },
      { year: 2027, start: "2027-03-26", end: "2027-03-29" },
      { year: 2028, start: "2028-04-14", end: "2028-04-17" },
    ],
    icons: [Egg, RabbitFace],
    hat: { Icon: RabbitFace, deg: 10 },
  },
  {
    id: "dragon-boat-festival",
    kind: "floating",
    occurrences: [
      { year: 2026, start: "2026-06-18", end: "2026-06-20" },
      { year: 2027, start: "2027-06-08", end: "2027-06-10" },
      { year: 2028, start: "2028-05-27", end: "2028-05-29" },
    ],
    icons: [Canoe, Dragon, Sparkles],
    hat: { Icon: Dragon, deg: 10 },
  },
  {
    id: "mid-autumn-festival",
    kind: "floating",
    occurrences: [
      { year: 2026, start: "2026-09-24", end: "2026-09-26" },
      { year: 2027, start: "2027-09-14", end: "2027-09-16" },
      { year: 2028, start: "2028-10-02", end: "2028-10-04" },
    ],
    icons: [MoonCake, FullMoon, Sparkles],
    hat: { Icon: MoonCake, deg: 10 },
  },
  {
    id: "halloween",
    kind: "fixed",
    month: 10,
    day: 31,
    spanDays: 1,
    icons: [JackOLantern, Ghost, Bat],
    hat: { Icon: JackOLantern, deg: 10 },
  },
  {
    id: "thanksgiving",
    kind: "floating",
    occurrences: [
      { year: 2026, start: "2026-11-26", end: "2026-11-29" },
      { year: 2027, start: "2027-11-25", end: "2027-11-28" },
      { year: 2028, start: "2028-11-23", end: "2028-11-26" },
    ],
    icons: [FallenLeaf, Turkey, EarOfCorn],
    hat: { Icon: Turkey, deg: 10 },
  },
  {
    id: "christmas",
    kind: "fixed",
    month: 12,
    day: 25,
    spanDays: 3,
    icons: [ChristmasTree, Snowflake, WrappedGift],
    hat: { Icon: ChristmasTree, deg: 10 },
  },
];
