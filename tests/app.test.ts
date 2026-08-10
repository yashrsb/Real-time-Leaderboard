import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";

vi.mock("../src/db/prisma.js", () => ({
  connectPrisma: vi.fn().mockResolvedValue(undefined),
  disconnectPrisma: vi.fn().mockResolvedValue(undefined),
  getPrisma: vi.fn().mockReturnValue({
    $queryRaw: vi.fn().mockResolvedValue([{ one: 1 }]),
  }),
}));

vi.mock("../src/db/redis.js", () => ({
  connectRedis: vi.fn().mockResolvedValue(undefined),
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
  createRedis: vi.fn().mockReturnValue({
    ping: vi.fn().mockResolvedValue("PONG"),
  }),
}));

describe("Application Startup", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/leaderboard";
    process.env.REDIS_URL = "redis://localhost:6379";
  });

  it("should build the Fastify application without starting an HTTP server", async () => {
    const app = await buildApp();
    expect(app).toBeDefined();
    expect(app.server).toBeDefined();

    await app.close();
  });
});
