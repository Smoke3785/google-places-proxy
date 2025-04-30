import fs from "fs";
import { PORT, CACHE_FILE, TTL } from "./config";
import type { PlaceDetails } from "./types";

// ─── FILE-BACKED CACHE SETUP ────────────────────────────────────────────────────
type RawCache = Record<
  string, // googleKey
  Record<
    string, // placeId
    { data: PlaceDetails; expires: number }
  >
>;

let rawCache: RawCache = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    rawCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  }
} catch (err) {
  console.warn("⚠️  Failed to parse cache file, starting fresh:", err);
}

// In-memory maps for fast lookup
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

// Persist helper
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
