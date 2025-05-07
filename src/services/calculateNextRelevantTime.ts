import { cache, persistCache } from "../cache";
import { CACHE_FILE, TTL, getConfigLog } from "../config";

import {
  normalizeGoogleApiResponse,
  getLatencyColor,
  getTimestamp,
  getCodeColor,
  isOpenNow,
  hr,
  getTimeNow,
} from "../utils";

// Types
import type { PlaceDetails } from "../types";

// Returns a string "HHMM" for the given date in UTC
function getCurrentTimeString(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}${minutes}`;
}

// Given an object { day, time } where day is 0 (Sunday) through 6 (Saturday)
// and time is a string like "0800", returns the Date for the next occurrence.
function getNextOccurrence({ day, time }: { day: number; time: string }): Date {
  const now = new Date();
  const currentDay = now.getUTCDay();

  // Calculate how many days to add
  let daysToAdd = day - currentDay;
  // If the day is in the past or it is today but the time has already passed, move to next week
  if (daysToAdd < 0 || (daysToAdd === 0 && time <= getCurrentTimeString(now))) {
    daysToAdd += 7;
  }

  const targetDate = new Date(now);
  targetDate.setUTCDate(now.getUTCDate() + daysToAdd);

  // Parse the time string "HHMM"
  const hours = parseInt(time.slice(0, 2), 10);
  const minutes = parseInt(time.slice(2), 10);
  targetDate.setUTCHours(hours, minutes, 0, 0);

  return targetDate;
}

// Given a Date, this function returns a friendly label indicating when that date occurs.
function computeNextLabel(nextDate: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(
    nextDate.getFullYear(),
    nextDate.getMonth(),
    nextDate.getDate()
  );
  // Correct diff calculation using getTime()
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    const hour = nextDate.getHours();
    if (hour < 12) {
      return "this morning";
    } else if (hour < 18) {
      return "this afternoon";
    } else {
      return "tonight";
    }
  } else if (diffDays === 1) {
    return "tomorrow";
  } else if (diffDays < 7) {
    const weekdayName = nextDate
      .toLocaleString("default", { weekday: "long" })
      .toLowerCase();
    if (nextDate.getDay() <= now.getDay()) {
      return `next ${weekdayName}`;
    } else {
      return `this ${weekdayName}`;
    }
  } else {
    return `in ${diffDays} days`;
  }
}

export type ParsedGoogleBusinessOpeningHours = {
  nextDateHumanReadableString: string;
  nextDate: Date | null;
  nextLabel: string;
  openNow: boolean;
};

// Main function that accepts a Google Places business hours response and returns
// openNow, nextDate, and a human-friendly nextLabel.
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

  // Determine if currently open (in America/New_York) via luxon-based util
  const openNow = isOpenNow(oh);

  // For each period, calculate the next occurrence for both close and open
  const times: Date[] = oh.periods.flatMap((p) => [
    getNextOccurrence(p.close),
    getNextOccurrence(p.open),
  ]);

  // Get the earliest upcoming date
  let nextDate: Date | null = null;
  for (const d of times) {
    if (nextDate === null || d < nextDate) nextDate = d;
  }

  const nextLabel = nextDate ? computeNextLabel(nextDate) : "";

  const nextDateHumanReadableString = calculateNextDateHumanReadableString({
    nextLabel,
    nextDate,
    openNow,
  });

  return { nextDateHumanReadableString, openNow, nextDate, nextLabel };
}

function calculateNextDateHumanReadableString({
  openNow,
  nextDate,
  nextLabel,
}: {
  nextDate: Date | null;
  nextLabel: string;
  openNow: boolean;
}): string {
  const formattedTimestamp =
    nextDate?.toLocaleTimeString(undefined, {
      minute: "2-digit",
      hour: "2-digit",
    }) || "";

  let nextDateHumanReadableString: string = "";
  if (!openNow) {
    nextDateHumanReadableString += "Closed. Opening at";
  } else {
    nextDateHumanReadableString += "Open until";
  }
  nextDateHumanReadableString += ` ${formattedTimestamp} `;
  nextDateHumanReadableString += openNow ? "today" : nextLabel;

  return nextDateHumanReadableString;
}
