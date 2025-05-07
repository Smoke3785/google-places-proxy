import { getTimeNow, isOpenNow } from "../utils";
import { DateTime } from "luxon";

// Types
import type { PlaceDetails } from "../types";

// Returns a string "HHMM" for the given DateTime in America/New_York
function getCurrentTimeString(dt: DateTime): string {
  return dt.toFormat("HHmm");
}

// Given an object { day, time } where day is 0 (Sunday) through 6 (Saturday)
// and time is a string like "0800", returns the Date for the next occurrence in EST.
function getNextOccurrence({ day, time }: { day: number; time: string }): Date {
  // Current EST DateTime
  const nowDT = DateTime.fromJSDate(getTimeNow()).setZone("America/New_York");
  const currentDay = nowDT.weekday % 7;
  const nowTimeStr = getCurrentTimeString(nowDT);

  let daysToAdd = day - currentDay;
  if (daysToAdd < 0 || (daysToAdd === 0 && time <= nowTimeStr)) {
    daysToAdd += 7;
  }

  const [hour, minute] = [
    parseInt(time.slice(0, 2), 10),
    parseInt(time.slice(2), 10),
  ];

  const targetDT = nowDT
    .plus({ days: daysToAdd })
    .set({ hour, minute, second: 0, millisecond: 0 });

  return targetDT.toJSDate();
}

// Given a Date, this function returns a friendly label indicating when that date occurs, in EST.
function computeNextLabel(nextDate: Date): string {
  const nowStart = DateTime.fromJSDate(getTimeNow())
    .setZone("America/New_York")
    .startOf("day");
  const targetStart = DateTime.fromJSDate(nextDate)
    .setZone("America/New_York")
    .startOf("day");
  const diffDays = targetStart.diff(nowStart, "days").days;

  if (diffDays === 0) {
    const hour = DateTime.fromJSDate(nextDate).setZone("America/New_York").hour;
    if (hour < 12) return "this morning";
    if (hour < 18) return "this afternoon";
    return "tonight";
  }
  if (diffDays === 1) return "tomorrow";

  if (diffDays < 7) {
    const weekdayName = DateTime.fromJSDate(nextDate)
      .setZone("America/New_York")
      .toFormat("cccc")
      .toLowerCase();
    const nextDayIdx =
      DateTime.fromJSDate(nextDate).setZone("America/New_York").weekday % 7;
    const currentDayIdx = nowStart.weekday % 7;
    return nextDayIdx <= currentDayIdx
      ? `next ${weekdayName}`
      : `this ${weekdayName}`;
  }

  return `in ${Math.round(diffDays)} days`;
}

export type ParsedGoogleBusinessOpeningHours = {
  nextDateHumanReadableString: string;
  nextDate: Date | null;
  nextLabel: string;
  openNow: boolean;
};

// Main function that accepts a Google Places business hours response and returns
// openNow, nextDate, and human-friendly strings.
export function calculateNextRelevantTime(
  details: PlaceDetails
): ParsedGoogleBusinessOpeningHours {
  const oh = details.opening_hours;
  if (!oh || !oh.periods) {
    return {
      nextDateHumanReadableString: "",
      openNow: false,
      nextDate: null,
      nextLabel: "",
    };
  }

  // Determine if currently open (in America/New_York)
  const openNow = isOpenNow(oh);

  // For each period, calculate the next occurrence for both close and open
  const times: Date[] = oh.periods.flatMap((p) => [
    getNextOccurrence(p.close),
    getNextOccurrence(p.open),
  ]);

  // Get the earliest upcoming date
  let nextDate: Date | null = null;
  for (const d of times) {
    if (!nextDate || d < nextDate) nextDate = d;
  }

  const nextLabel = nextDate ? computeNextLabel(nextDate) : "";

  // Human-readable time string in EST
  const formattedTime = nextDate
    ? DateTime.fromJSDate(nextDate)
        .setZone("America/New_York")
        .toLocaleString(DateTime.TIME_SIMPLE)
    : "";

  const nextDateHumanReadableString =
    (openNow ? "Open until" : "Closed. Opening at") +
    ` ${formattedTime} ` +
    (openNow ? "today" : nextLabel);

  return { nextDateHumanReadableString, nextDate, nextLabel, openNow };
}
