// server.ts
import express from "express";
import chalk from "chalk";

import { cache, persistCache } from "./cache";
import { initializeDatabase, logRequest, getRequestLogs } from "./database";
import { CACHE_FILE, TTL, getConfigLog } from "./config";
import {
  normalizeGoogleApiResponse,
  getLatencyColor,
  getTimestamp,
  getCodeColor,
  isOpenNow,
  hr,
  getTimeNow,
} from "./utils";

// Types
import type { PlaceDetails } from "./types";

const app = express();

app.use((req, res, next) => {
  const start = Date.now();

  res.locals.cacheHit = undefined;
  res.locals.forwarded = false;
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

    if (res.locals.logMe === true) {
      logRequest({
        googleKey: req.query.key as string,
        forwarded: res.locals.forwarded,
        cacheHit: res.locals.cacheHit,
        placeId: req.params.placeId,
        statusCode: res.statusCode,
        error: res.locals.error,
        timestamp: start,
      }).catch((err) => {
        console.error(
          `${getTimestamp()} ${chalk.red("ERROR")}`,
          "Failed to log request",
          err
        );
      });
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

app.get("/stats", async (req, res) => {
  const stats = await getRequestLogs();
  const now = getTimeNow();

  const timeZone = now.toString().split("GMT")[1];
  res.json({ timeZone, stats });
});

app.get("/places/:placeId", async (req, res) => {
  res.locals.logMe = true;

  const placeId = req.params.placeId;
  const googleKey = (req.query.key as string) || "";

  if (!googleKey) {
    res.status(400).json({ error: "Missing API key in `?key=`" });
    return;
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

      res.json(copy);
      return;
    }
  }

  res.locals.cacheHit = false;
  res.locals.forwarded = true;

  const urlString = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${googleKey}`;
  const url = new URL(urlString);

  const upstream = await fetch(url.toString());
  if (!upstream.ok) {
    res.status(upstream.status).send(await upstream.text());
    return;
  }

  const { data, error } = await normalizeGoogleApiResponse<PlaceDetails>(
    upstream
  );

  if (error || !data) {
    res.locals.debug.push(urlString, error);
    res.status(500).json({ error });
    return;
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

  res.json(data);
  return;
});

(async () => {
  await initializeDatabase();
  const port = process.env.PORT ? +process.env.PORT : 3000;
  app.listen(port, () => {
    console.log(
      `${getTimestamp()} ►  running on http://localhost:${port}/places/:placeId?key=YOUR_GOOGLE_KEY`
    );

    console.log(`${getTimestamp()} ►  CONFIGURATION`, getConfigLog());
    console.log(hr("SERVER LIVE"));
  });
})();
