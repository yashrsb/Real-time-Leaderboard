import Redis from "ioredis";

let redisClient: Redis | null = null;

export function createRedis(url: string): Redis {
  if (!redisClient) {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
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
