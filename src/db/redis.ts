import Redis from "ioredis";
import type { RedisOptions } from "ioredis";

let redisClient: Redis | null = null;

export function createRedis(url: string): Redis {
  if (!redisClient) {
    const options: RedisOptions = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    const parsedUrl = new URL(url);
    if (
      url.startsWith("rediss://") ||
      parsedUrl.hostname.includes("upstash.io")
    ) {
      options.tls = {};
    }

    redisClient = new Redis(url, options);
  }
  return redisClient;
}

export async function connectRedis(redis: Redis): Promise<void> {
  await redis.ping();
}

export async function disconnectRedis(redis: Redis): Promise<void> {
  await redis.quit();
  redisClient = null;
}
