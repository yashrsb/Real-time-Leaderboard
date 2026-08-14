import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../../src/app";
import { resetEnvCache } from "../../src/config/index";
import type { Env } from "../../src/config/env";

const unique = `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const mockEnv: Env = {
  JWT_SECRET: "test-secret-key-that-is-long-enough-for-hs256",
  JWT_EXPIRES_IN: "15m",
  NODE_ENV: "test",
  PORT: 3000,
  HOST: "0.0.0.0",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/leaderboard",
  REDIS_URL: "redis://localhost:6379",
};

describe("Reports Endpoints", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let authToken: string;
  let gameId: string;
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = mockEnv.JWT_SECRET;
    process.env.JWT_EXPIRES_IN = mockEnv.JWT_EXPIRES_IN;

    app = await buildApp();

    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      body: {
        username: `reportuser_${unique}`,
        email: `report_${unique}@example.com`,
        password: "secure-password-123",
      },
    });
    expect(registerResponse.statusCode).toBe(201);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      body: {
        email: `report_${unique}@example.com`,
        password: "secure-password-123",
      },
    });
    const loginBody = JSON.parse(loginResponse.body);
    authToken = loginBody.accessToken;
    userId = loginBody.user.id;

    const createGameResponse = await app.inject({
      method: "POST",
      url: "/api/v1/games",
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      body: {
        name: `Report Game ${unique}`,
        slug: `report-game-${unique}`,
      },
    });
    expect(createGameResponse.statusCode).toBe(201);
    const createGameBody = JSON.parse(createGameResponse.body);
    gameId = createGameBody.game.id;
  });

  afterAll(async () => {
    if (app) {
      await app.prisma.score.deleteMany({
        where: {
          userId,
        },
      });
      await app.prisma.game.deleteMany({
        where: {
          OR: [
            { name: { contains: `Report Game ${unique}` } },
            { slug: { contains: `report-game-${unique}` } },
          ],
        },
      });
      await app.prisma.user.deleteMany({
        where: {
          OR: [
            { username: { contains: `reportuser_${unique}` } },
            { email: { contains: `report_${unique}` } },
          ],
        },
      });

      if (gameId) {
        try {
          await app.redis.del(`leaderboard:game:${gameId}`);
        } catch {
          // ignore redis cleanup errors
        }
      }
    }
  });

  afterEach(() => {
    resetEnvCache();
  });

  afterEach(async () => {
    if (app && userId) {
      await app.prisma.score.deleteMany({
        where: {
          userId,
        },
      });
    }
  });

  describe("GET /api/v1/reports/top-players", () => {
    it("should aggregate all score submissions during the period", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: { authorization: `Bearer ${authToken}` },
        body: { score: 1000 },
      });
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: { authorization: `Bearer ${authToken}` },
        body: { score: 1500 },
      });
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: { authorization: `Bearer ${authToken}` },
        body: { score: 1200 },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?gameId=${gameId}&from=2000-01-01&to=2099-12-31`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].score).toBe(3700);
      expect(body.entries[0].userId).toBe(userId);
      expect(body.entries[0].username).toBeDefined();
      expect(body.pagination.totalPlayers).toBe(1);
    });

    it("should generate report independent from Redis", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: { authorization: `Bearer ${authToken}` },
        body: { score: 1000 },
      });
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: { authorization: `Bearer ${authToken}` },
        body: { score: 1500 },
      });
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: { authorization: `Bearer ${authToken}` },
        body: { score: 1200 },
      });

      const member = `user:${userId}`;
      const redisScore = await app.redis.zscore(
        `leaderboard:game:${gameId}`,
        member,
      );

      const reportResponse = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?gameId=${gameId}&from=2000-01-01&to=2099-12-31`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(reportResponse.statusCode).toBe(200);
      const reportBody = JSON.parse(reportResponse.body);
      expect(reportBody.entries[0].score).toBe(3700);
      expect(Number(redisScore)).toBeGreaterThanOrEqual(1500);
    });

    it("should filter by specific game", async () => {
      const otherGameResponse = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: { authorization: `Bearer ${authToken}` },
        body: {
          name: `Other Report Game ${unique}`,
          slug: `other-report-game-${unique}`,
        },
      });
      expect(otherGameResponse.statusCode).toBe(201);
      const otherGameBody = JSON.parse(otherGameResponse.body);
      const otherGameId = otherGameBody.game.id;

      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: { authorization: `Bearer ${authToken}` },
        body: { score: 1000 },
      });
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: { authorization: `Bearer ${authToken}` },
        body: { score: 1500 },
      });
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${otherGameId}/scores`,
        headers: { authorization: `Bearer ${authToken}` },
        body: { score: 5000 },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?gameId=${gameId}&from=2000-01-01&to=2099-12-31`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].score).toBe(2500);
      expect(body.gameId).toBe(gameId);
    });

    it("should paginate correctly", async () => {
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: "POST",
          url: `/api/v1/games/${gameId}/scores`,
          headers: { authorization: `Bearer ${authToken}` },
          body: { score: 100 + i },
        });
      }

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?gameId=${gameId}&from=2000-01-01&to=2099-12-31&page=1&limit=2`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(1);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.totalPlayers).toBe(1);
      expect(body.pagination.totalPages).toBe(1);
    });

    it("should return empty entries for page beyond last page", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: { authorization: `Bearer ${authToken}` },
        body: { score: 100 },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?gameId=${gameId}&from=2000-01-01&to=2099-12-31&page=999&limit=20`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(0);
      expect(body.pagination.totalPlayers).toBe(1);
    });

    it("should return 200 for valid period with no matching scores", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?from=2000-01-01&to=2000-01-02`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(0);
      expect(body.pagination.totalPlayers).toBe(0);
      expect(body.pagination.totalPages).toBe(0);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?from=2000-01-01&to=2099-12-31`,
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 400 when from is missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?to=2099-12-31`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 when to is missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?from=2000-01-01`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 when from > to", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?from=2099-12-31&to=2000-01-01`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for invalid date format", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?from=not-a-date&to=2099-12-31`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for invalid page", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?from=2000-01-01&to=2099-12-31&page=0`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for limit greater than 100", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?from=2000-01-01&to=2099-12-31&limit=101`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for invalid game UUID", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?from=2000-01-01&to=2099-12-31&gameId=not-a-uuid`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 404 for nonexistent game", async () => {
      const fakeGameId = "00000000-0000-0000-0000-000000000000";
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reports/top-players?from=2000-01-01&to=2099-12-31&gameId=${fakeGameId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("GAME_NOT_FOUND");
    });
  });
});
