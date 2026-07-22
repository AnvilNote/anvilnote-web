import type { ComponentType, SVGProps } from "react";
import { HOLIDAYS } from "./data";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export interface HolidayHat {
  Icon: Icon;
  /** Rotation applied on top of the sidebar logo, in degrees. */
  deg: number;
}

interface HolidayBase {
  id: string;
  icons: Icon[];
  hat: HolidayHat;
}

/** Recurs on the same Gregorian month/day every year — needs no yearly upkeep. */
export interface FixedHoliday extends HolidayBase {
  kind: "fixed";
  month: number;
  day: number;
  spanDays: number;
}

/** Lunar or other non-fixed dates — each year it occurs must be listed explicitly. */
export interface FloatingHoliday extends HolidayBase {
  kind: "floating";
  occurrences: { year: number; start: string; end: string }[];
}

export type HolidayConfig = FixedHoliday | FloatingHoliday;

export interface ActiveHoliday {
  id: string;
  icons: Icon[];
  hat: HolidayHat;
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function matchesFixed(holiday: FixedHoliday, date: Date): boolean {
  const start = new Date(date.getFullYear(), holiday.month - 1, holiday.day);
  const end = new Date(date.getFullYear(), holiday.month - 1, holiday.day + holiday.spanDays - 1);
  const startStr = toLocalDateString(start);
  const endStr = toLocalDateString(end);
  const dateStr = toLocalDateString(date);
  return startStr <= dateStr && dateStr <= endStr;
}

function matchesFloating(holiday: FloatingHoliday, date: Date): boolean {
  const dateStr = toLocalDateString(date);
  return holiday.occurrences.some(
    (occurrence) => occurrence.year === date.getFullYear() && occurrence.start <= dateStr && dateStr <= occurrence.end,
  );
}

/** Returns the holiday active on the given date (local time), if any. */
export function getActiveHoliday(
  date: Date = new Date(),
  holidays: HolidayConfig[] = HOLIDAYS,
): ActiveHoliday | null {
  const holiday = holidays.find((candidate) =>
    candidate.kind === "fixed" ? matchesFixed(candidate, date) : matchesFloating(candidate, date),
  );
  if (!holiday) return null;
  return { id: holiday.id, icons: holiday.icons, hat: holiday.hat };
}
