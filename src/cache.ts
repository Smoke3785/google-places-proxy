import fs from "fs";
import type { PlaceDetails } from "./types";
import { getTimestamp } from "./utils";
import { CACHE_FILE } from "./config";

// ─── FILE-BACKED CACHE SETUP ────────────────────────────────────────────────────
type RawCache = Record<
  string,
  Record<string, { data: PlaceDetails; expires: number }>
>;

let rawCache: RawCache = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    console.log(`${getTimestamp()} 🔄 Loading cache from ${CACHE_FILE}`);
    rawCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  } else {
    console.log(`${getTimestamp()} 🗑️ Cache file not found, starting fresh.`);
  }
} catch (err) {
  console.warn("⚠️ Failed to parse cache file, starting fresh:", err);
}

export const cache = new Map<
  string,
  Map<string, { data: PlaceDetails; expires: number }>
>();

for (const [key, placeMap] of Object.entries(rawCache)) {
  const m = new Map<string, { data: PlaceDetails; expires: number }>();
  for (const [placeId, entry] of Object.entries(placeMap)) {
    m.set(placeId, entry);
  }
  cache.set(key, m);
}

export function persistCache() {
  const dump: RawCache = {};
  for (const [googleKey, placeMap] of cache.entries()) {
    dump[googleKey] = {};
    for (const [placeId, entry] of placeMap.entries()) {
      dump[googleKey][placeId] = entry;
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(dump, null, 2));
}
