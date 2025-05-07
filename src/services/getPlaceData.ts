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

type GetPlaceDataParams = {
  googleKey: string;
  placeId: string;
};

type GetPlaceDataResponse = Promise<
  StandardResponse<{
    placeData: PlaceDetails;
    locals: {
      forwarded: boolean;
      cacheHit: boolean;
      debug?: any;
    };
  }>
>;

export async function getPlaceData({
  googleKey,
  placeId,
}: GetPlaceDataParams): GetPlaceDataResponse {
  let forwarded = false;
  let cacheHit = false;

  let keyMap = cache.get(googleKey);
  const now = Date.now();

  if (keyMap) {
    const entry = keyMap.get(placeId);

    if (entry && entry.expires > now) {
      cacheHit = true;

      const copy = JSON.parse(JSON.stringify(entry.data)) as PlaceDetails;
      const open_now = isOpenNow(copy.opening_hours);

      if (copy.current_opening_hours) {
        copy.current_opening_hours.open_now = open_now;
      }

      if (copy.opening_hours) {
        copy.opening_hours.open_now = open_now;
      }

      return {
        data: { placeData: copy, locals: { cacheHit, forwarded } },
        error: undefined,
      };
    }
  }
  cacheHit = false;
  forwarded = true;

  const urlString = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${googleKey}`;
  const url = new URL(urlString);

  const upstream = await fetch(url.toString());

  if (!upstream.ok) {
    const message = `Error fetching place data upstream - ${
      upstream.statusText
    }: ${await upstream.text()}`;
    return {
      data: undefined,
      error: {
        code: 500,
        message,
      },
    };
  }

  const { data, error } = await normalizeGoogleApiResponse<PlaceDetails>(
    upstream
  );

  if (error || !data) {
    return {
      data: undefined,
      error,
    };
  }

  if (data.opening_hours) {
    data.opening_hours.open_now = isOpenNow(data.opening_hours);
  }

  if (!keyMap) {
    keyMap = new Map();
    cache.set(googleKey, keyMap);
  }

  keyMap.set(placeId, { data, expires: now + TTL });
  persistCache();

  return {
    data: { placeData: data, locals: { cacheHit, forwarded } },
    error: undefined,
  };
}
