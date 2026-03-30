import cors from "cors";
import express from "express";
import { createClient } from "redis";

const app = express();
const port = Number(process.env.PORT || 8091);
const defaultTtlSeconds = Number(process.env.DEFAULT_TTL_SECONDS || 60);
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

app.use(cors());
app.use(express.json());

const memoryStore = new Map();
const redis = createClient({ url: redisUrl });
let redisReady = false;

redis.on("error", (error) => {
  redisReady = false;
  console.warn("Redis unavailable, using in-memory fallback.", error.message);
});

redis.on("ready", () => {
  redisReady = true;
});

redis.connect().catch((error) => {
  redisReady = false;
  console.warn("Initial Redis connection failed, using in-memory fallback.", error.message);
});

const readFromMemory = (key) => {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }

  return {
    cacheKey: key,
    responsePayload: entry.responsePayload,
    ttlSeconds: Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000))
  };
};

const writeToMemory = (key, responsePayload, ttlSeconds) => {
  memoryStore.set(key, {
    responsePayload,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
};

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "result-cache-service",
    backend: redisReady ? "redis" : "memory"
  });
});

app.get("/api/v1/cache/:cacheKey", async (request, response) => {
  const cacheKey = request.params.cacheKey;

  try {
    if (redisReady) {
      const cachedValue = await redis.get(cacheKey);
      if (!cachedValue) {
        return response.status(404).json({ hit: false, cacheKey });
      }

      const ttlSeconds = await redis.ttl(cacheKey);
      return response.json({
        hit: true,
        cacheKey,
        responsePayload: JSON.parse(cachedValue),
        ttlSeconds
      });
    }

    const entry = readFromMemory(cacheKey);
    if (!entry) {
      return response.status(404).json({ hit: false, cacheKey });
    }

    return response.json({ hit: true, ...entry });
  } catch (error) {
    return response.status(500).json({ hit: false, cacheKey, error: error.message });
  }
});

app.put("/api/v1/cache/:cacheKey", async (request, response) => {
  const cacheKey = request.params.cacheKey;
  const ttlSeconds = Number(request.body?.ttlSeconds || defaultTtlSeconds);
  const responsePayload = request.body?.responsePayload || {};

  try {
    if (redisReady) {
      await redis.set(cacheKey, JSON.stringify(responsePayload), { EX: ttlSeconds });
    } else {
      writeToMemory(cacheKey, responsePayload, ttlSeconds);
    }

    return response.status(204).send();
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
});

app.post("/api/v1/cache/flush", async (_request, response) => {
  try {
    if (redisReady) {
      await redis.flushDb();
    }
    memoryStore.clear();
    return response.status(204).send();
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`result-cache-service listening on ${port}`);
});
