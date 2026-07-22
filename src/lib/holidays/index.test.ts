import { describe, expect, it } from "vitest";
import { getActiveHoliday, type HolidayConfig } from "./index";

function FakeIcon() {
  return null;
}

const fixedHoliday: HolidayConfig = {
  id: "test-fixed",
  kind: "fixed",
  month: 12,
  day: 25,
  spanDays: 3,
  icons: [FakeIcon],
  hat: { Icon: FakeIcon, deg: 10 },
};

const floatingHoliday: HolidayConfig = {
  id: "test-floating",
  kind: "floating",
  occurrences: [{ year: 2026, start: "2026-02-14", end: "2026-02-23" }],
  icons: [FakeIcon],
  hat: { Icon: FakeIcon, deg: -30 },
};

describe("getActiveHoliday", () => {
  it("matches a fixed holiday on its start date", () => {
    expect(getActiveHoliday(new Date(2026, 11, 25), [fixedHoliday])?.id).toBe("test-fixed");
  });

  it("matches a fixed holiday on the last day of its span", () => {
    expect(getActiveHoliday(new Date(2026, 11, 27), [fixedHoliday])?.id).toBe("test-fixed");
  });

  it("does not match a fixed holiday the day after its span ends", () => {
    expect(getActiveHoliday(new Date(2026, 11, 28), [fixedHoliday])).toBeNull();
  });

  it("does not match a fixed holiday the day before it starts", () => {
    expect(getActiveHoliday(new Date(2026, 11, 24), [fixedHoliday])).toBeNull();
  });

  it("matches a fixed holiday regardless of year", () => {
    expect(getActiveHoliday(new Date(2030, 11, 26), [fixedHoliday])?.id).toBe("test-fixed");
  });

  it("matches a single-day fixed holiday only on that day", () => {
    const singleDay: HolidayConfig = { ...fixedHoliday, spanDays: 1 };
    expect(getActiveHoliday(new Date(2026, 11, 25), [singleDay])?.id).toBe("test-fixed");
    expect(getActiveHoliday(new Date(2026, 11, 26), [singleDay])).toBeNull();
  });

  it("matches a floating holiday during its listed occurrence", () => {
    expect(getActiveHoliday(new Date(2026, 1, 17), [floatingHoliday])?.id).toBe("test-floating");
  });

  it("does not match a floating holiday in a year with no listed occurrence", () => {
    expect(getActiveHoliday(new Date(2027, 1, 17), [floatingHoliday])).toBeNull();
  });

  it("returns the hat icon and rotation degrees", () => {
    expect(getActiveHoliday(new Date(2026, 11, 25), [fixedHoliday])?.hat).toEqual({
      Icon: FakeIcon,
      deg: 10,
    });
  });

  it("returns null when no holiday is active", () => {
    expect(getActiveHoliday(new Date(2026, 5, 15), [fixedHoliday, floatingHoliday])).toBeNull();
  });
});
