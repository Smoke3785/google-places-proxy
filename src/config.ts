import dotenv from "dotenv";
import chalk from "chalk";
import path from "path";
dotenv.config();

// Files
const CACHE_FILE =
  process.env.CACHE_FILE || path.resolve(__dirname, "cache.json");
const DB_FILE = process.env.DB_FILE || path.resolve(__dirname, "logs.sqlite");

// Networking
const PORT = process.env.PORT ? +process.env.PORT : 3000;

// Cache
const TTL = process.env.CACHE_TIME
  ? +process.env.CACHE_TIME
  : 24 * 60 * 60 * 1_000; // 24h

export { PORT, DB_FILE, CACHE_FILE, TTL };
const config = {
  CACHE_FILE,
  DB_FILE,
  PORT,
  TTL,
};

const space = " ".repeat(30);
export function getConfigLog() {
  let msg = "";

  for (const [key, value] of Object.entries(config)) {
    msg += `\n${space}${chalk.blue(key)}: ${value}`;
  }
  return msg;
}
