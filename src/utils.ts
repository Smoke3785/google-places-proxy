import { type StandardResponse } from "@iliad.dev/ts-utils";
import type { OpeningHours } from "./types";

import chalk from "chalk";
type NormalizedGoogleApiResponse<T> = Promise<
  StandardResponse<
    T,
    {
      message: string;
      status: string;
      code: number;
    }
  >
>;

export async function normalizeGoogleApiResponse<T = any>(
  response: Response
): NormalizedGoogleApiResponse<T> {
  const statusToCode = (status: string): number => {
    if (status === "OK") return 200;
    if (status === "ZERO_RESULTS") return 204;
    if (status === "OVER_QUERY_LIMIT") return 429;
    if (status === "REQUEST_DENIED") return 403;
    if (status === "INVALID_REQUEST") return 400;
    if (status === "NOT_FOUND") return 404;
    if (status === "UNKNOWN_ERROR") return 500;
    if (status === "INVALID_ARGUMENT") return 400;
    if (status === "TIMEOUT") return 408;
    if (status === "INVALID_VALUE") return 422;
    if (status === "PERMISSION_DENIED") return 403;
    if (status === "RATE_LIMIT_EXCEEDED") return 429;
    if (status === "USER_RATE_LIMIT_EXCEEDED") return 429;
    if (status === "SERVICE_NOT_AVAILABLE") return 503;
    if (status === "NOT_AUTHORIZED") return 401;
    if (status === "NOT_SUPPORTED") return 501;
    if (status === "NOT_IMPLEMENTED") return 501;
    if (status === "NOT_ALLOWED") return 405;
    if (status === "NOT_ACCEPTABLE") return 406;
    if (status === "NOT_MODIFIED") return 304;
    if (status === "CONFLICT") return 409;
    if (status === "GONE") return 410;
    if (status === "PRECONDITION_FAILED") return 412;
    if (status === "UNSUPPORTED_MEDIA_TYPE") return 415;
    if (status === "UNPROCESSABLE_ENTITY") return 422;
    return 500;
  };

  if (!response?.ok) {
    // This is a network error
    return {
      data: undefined,
      error: {
        message: response.statusText,
        status: response.statusText,
        code: response.status,
      },
    };
  }

  // For whatever reason, Google APIs will return a 200 status even if there's a failure. For this reason, we must normalize this response.
  // First, lets attempt to parse the response as JSON
  let body: any;
  try {
    body = await response.json();
  } catch (error) {
    return {
      data: undefined,
      error: {
        message: `Error parsing response: ${error}`,
        status: response.statusText,
        code: response.status,
      },
    };
  }

  if (body?.error_message) {
    return {
      data: undefined,
      error: {
        message: body.error_message,
        status: body.status,
        code: statusToCode(body.status),
      },
    };
  }

  return {
    data: body?.result as T,
    error: undefined,
  };
}

export function parseHHMM(s: string): number {
  return parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2), 10);
}

export function isOpenNow(oh: OpeningHours, now: Date = new Date()): boolean {
  if (!oh.periods) return false;
  const today = now.getDay(); // 0=Sun…6=Sat
  const nowMins = now.getHours() * 60 + now.getMinutes();

  for (const p of oh.periods) {
    const oD = p.open.day,
      cD = p.close.day;
    const oM = parseHHMM(p.open.time),
      cM = parseHHMM(p.close.time);

    if (oD === cD) {
      if (today === oD && nowMins >= oM && nowMins < cM) return true;
    } else {
      // overnight span
      if ((today === oD && nowMins >= oM) || (today === cD && nowMins < cM)) {
        return true;
      }
    }
  }
  return false;
}

function getHttpCodeColor(code: number): string {
  if (code >= 200 && code < 300) return "green";
  if (code >= 300 && code < 400) return "yellow";
  if (code >= 400 && code < 500) return "red";

  if (code >= 500) return "magenta";

  return "gray";
}

export function getCodeColor(code: number) {
  return chalk[getHttpCodeColor(code)];
}

function getLatencyTimeColor(ms: number): string {
  if (ms < 250) return "green";
  if (ms < 500) return "yellow";
  if (ms < 500) return "orange";
  if (ms < 1000) return "red";

  return "magenta";
}

export function getLatencyColor(ms: number) {
  const color = getLatencyTimeColor(ms);
  if (color === "orange") return chalk.hex("#FFA500");
  return chalk[color];
}

export function getTimestamp() {
  return chalk.bgBlack(`[${new Date().toISOString()}]`);
}

export function hr(message: string) {
  const width = process.stdout.columns || 80;
  const emptySpace = message?.length;

  const left = " ".repeat((width - emptySpace) / 2);
  const right = " ".repeat(width - emptySpace - left.length);
  const hr = "─".repeat(width);

  return `${hr}${left}${message}${right}${hr}`;
}
