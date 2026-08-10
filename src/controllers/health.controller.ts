import type { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

export type HealthDependencies = {
  postgres: "ok" | "degraded";
  redis: "ok" | "degraded";
};

export type HealthResponse = {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: HealthDependencies;
};

export async function getHealth(
  prisma: PrismaClient,
  redis: Redis,
): Promise<HealthResponse> {
  const dependencies: HealthDependencies = {
    postgres: "ok",
    redis: "ok",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dependencies.postgres = "degraded";
  }

  try {
    await redis.ping();
  } catch {
    dependencies.redis = "degraded";
  }

  const overall =
    dependencies.postgres === "ok" && dependencies.redis === "ok"
      ? "ok"
      : "degraded";

  return {
    status: overall,
    timestamp: new Date().toISOString(),
    dependencies,
  };
}
