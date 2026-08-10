import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { resetEnvCache } from "../src/config/index.js";

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([{ one: 1 }]),
}));

const mockRedis = vi.hoisted(() => ({
  ping: vi.fn().mockResolvedValue("PONG"),
}));

vi.mock("../src/db/prisma.js", () => ({
  connectPrisma: vi.fn().mockResolvedValue(undefined),
  disconnectPrisma: vi.fn().mockResolvedValue(undefined),
  getPrisma: vi.fn().mockReturnValue(mockPrisma),
}));

vi.mock("../src/db/redis.js", () => ({
  connectRedis: vi.fn().mockResolvedValue(undefined),
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
  createRedis: vi.fn().mockReturnValue(mockRedis),
}));

afterEach(() => {
  resetEnvCache();
  mockPrisma.$queryRaw.mockReset();
  mockRedis.ping.mockReset();
});

describe("Health Endpoint", () => {
  beforeEach(() => {
    mockPrisma.$queryRaw.mockResolvedValue([{ one: 1 }]);
    mockRedis.ping.mockResolvedValue("PONG");
  });

  it("GET /api/v1/health should return 200 when dependencies are healthy", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/leaderboard";
    process.env.REDIS_URL = "redis://localhost:6379";

    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("ok");
    expect(body.dependencies.postgres).toBe("ok");
    expect(body.dependencies.redis).toBe("ok");

    await app.close();
  });

  it("GET /api/v1/health should return 503 when postgres is degraded", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/leaderboard";
    process.env.REDIS_URL = "redis://localhost:6379";

    mockPrisma.$queryRaw.mockRejectedValue(new Error("DB down"));

    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.postgres).toBe("degraded");
    expect(body.dependencies.redis).toBe("ok");

    await app.close();
  });

  it("GET /api/v1/health should return 503 when redis is degraded", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/leaderboard";
    process.env.REDIS_URL = "redis://localhost:6379";

    mockRedis.ping.mockRejectedValue(new Error("Redis down"));

    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.postgres).toBe("ok");
    expect(body.dependencies.redis).toBe("degraded");

    await app.close();
  });
});
