import dotenv from "dotenv";
import path from "path";
dotenv.config();

// ─── CONFIG ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ? +process.env.PORT : 3000;
const CACHE_FILE =
  process.env.CACHE_FILE || path.resolve(__dirname, "cache.json");

const TTL = process.env.CACHE_TIME
  ? +process.env.CACHE_TIME
  : 24 * 60 * 60 * 1_000; // 24h

export { PORT, CACHE_FILE, TTL };
