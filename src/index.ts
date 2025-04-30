// server.ts
import express from "express";
import chalk from "chalk";

import { PORT, CACHE_FILE, TTL } from "./config";
import { cache, persistCache } from "./cache";
import {
  normalizeGoogleApiResponse,
  getLatencyColor,
  getTimestamp,
  getCodeColor,
  isOpenNow,
} from "./utils";

// Types
import type { PlaceDetails } from "./types";

const app = express();

app.use((req, res, next) => {
  const start = Date.now();

  res.locals.cacheHit = undefined;
  res.locals.debug = [];

  console.log(
    `${getTimestamp()} ${chalk.blue(`→ ${req.method}`)} ${req.originalUrl}`
  );

  res.once("finish", () => {
    const ms = Date.now() - start;
    const statusColor = res.statusCode < 400 ? chalk.green : chalk.red;
    const codeColor = getCodeColor(res.statusCode);
    const timeColor = getLatencyColor(ms);

    let cacheMsg = "";

    if (res.locals.cacheHit === true) cacheMsg = chalk.magenta(" [cache hit]");
    if (res.locals.cacheHit === false) cacheMsg = chalk.yellow(" [cache miss]");

    console.log(
      `${getTimestamp()} ${statusColor(`← ${req.method}`)} ${
        req.originalUrl
      } ${codeColor(res.statusCode)} ${timeColor(`${ms}ms`)} ${cacheMsg}`
    );

    if (res?.locals?.debug?.length) {
      console.debug(
        `${getTimestamp()} ${chalk.gray("DEBUG")}`,
        ...res.locals.debug
      );
    }
  });

  next();
});

app.get("/health", (req, res) => {
  res.json({
    cache: {
      cacheFile: CACHE_FILE?.replace(process.cwd(), ""),
      size: cache.size,
      ttl: TTL,
    },
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    status: "ok",
  });
});

// @ts-ignore
app.get("/places/:placeId", async (req, res) => {
  const placeId = req.params.placeId;
  const googleKey = (req.query.key as string) || "";
  if (!googleKey) {
    return res.status(400).json({ error: "Missing API key in `?key=`" });
  }

  let keyMap = cache.get(googleKey);
  const now = Date.now();

  if (keyMap) {
    const entry = keyMap.get(placeId);

    if (entry && entry.expires > now) {
      res.locals.cacheHit = true;

      const copy = JSON.parse(JSON.stringify(entry.data)) as PlaceDetails;
      if (copy.opening_hours) {
        copy.opening_hours.open_now = isOpenNow(copy.opening_hours);
      }

      return res.json(copy);
    }
  }

  res.locals.cacheHit = false;

  const urlString = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${googleKey}`;
  const url = new URL(urlString);

  const upstream = await fetch(url.toString());
  if (!upstream.ok) {
    return res.status(upstream.status).send(await upstream.text());
  }

  const { data, error } = await normalizeGoogleApiResponse<PlaceDetails>(
    upstream
  );

  if (error || !data) {
    res.locals.debug.push(urlString, error);
    return res.status(500).json({ error });
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

  return res.json(data);
});

const port = process.env.PORT ? +process.env.PORT : 3000;
app.listen(port, () => {
  console.log(
    `${getTimestamp()} ► running on http://localhost:${port}/places/:placeId?key=YOUR_GOOGLE_KEY`
  );

  const space = " ".repeat(30);

  console.log(
    `${getTimestamp()} ► CONFIGURATION`,
    `\n${space}${chalk.blue("CACHE_FILE")}: ${CACHE_FILE?.replace(
      process.cwd(),
      ""
    )}\n${space}${chalk.blue("TTL")}: ${TTL}ms\n${space}${chalk.blue(
      "PORT"
    )}: ${port}`
  );
});
