import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";

import { getTimestamp } from "./utils";
import { DB_FILE } from "./config";

let db: Database;
export async function initializeDatabase(): Promise<Database> {
  console.log(`${getTimestamp()} 🗃️  Loading database from ${DB_FILE}`);

  if (db) return db;

  db = await open({
    driver: sqlite3.Database,
    filename: DB_FILE,
  });

  await db.exec(`
        CREATE TABLE IF NOT EXISTS request_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          place_id TEXT,
          google_key TEXT,
          cache_hit INTEGER,
          status_code INTEGER,
          forwarded INTEGER,
          error TEXT
        );
      `);

  return db;
}

type RequestLogParams = {
  timestamp: number;
  placeId: Nullable<string>;
  googleKey: Nullable<string>;
  cacheHit: boolean;
  statusCode: number;
  forwarded: boolean;
  error: Nullable<string>;
};
export async function logRequest(params: RequestLogParams) {
  const {
    timestamp,
    placeId,
    googleKey,
    cacheHit,
    statusCode,
    forwarded,
    error,
  } = params;
  try {
    await db.run(
      `INSERT INTO request_logs (timestamp, place_id, google_key, cache_hit, status_code, forwarded, error) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        timestamp,
        placeId,
        googleKey,
        cacheHit ? 1 : 0,
        statusCode,
        forwarded ? 1 : 0,
        error,
      ]
    );
  } catch (err) {
    console.error("Failed to log request:", err);
  }
}

export async function getRequestLogs() {
  const now = Date.now();
  const periods = [
    { label: "3_days", ms: 3 * 24 * 3600 * 1000 },
    { label: "7_days", ms: 7 * 24 * 3600 * 1000 },
    { label: "30_days", ms: 30 * 24 * 3600 * 1000 },
    { label: "365_days", ms: 365 * 24 * 3600 * 1000 },
  ];
  const stats: Record<string, any> = {};

  for (const p of periods) {
    const since = now - p.ms;
    const rows = await db.all(
      `SELECT
           COUNT(*) as total,
           SUM(cache_hit) as hits,
           SUM(1 - cache_hit) as misses,
           SUM(forwarded) as forwarded,
           SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
         FROM request_logs WHERE timestamp > ?`,
      since
    );
    stats[p.label] = rows[0];
  }

  return stats;
}
