import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../../src/app";
import { resetEnvCache } from "../../src/config/index";
import type { Env } from "../../src/config/env";

const unique = `score-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const mockEnv: Env = {
  JWT_SECRET: "test-secret-key-that-is-long-enough-for-hs256",
  JWT_EXPIRES_IN: "15m",
  NODE_ENV: "test",
  PORT: 3000,
  HOST: "0.0.0.0",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/leaderboard",
  REDIS_URL: "redis://localhost:6379",
};

describe("Score Endpoints", () => {
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
        username: `scoreuser_${unique}`,
        email: `score_${unique}@example.com`,
        password: "secure-password-123",
      },
    });
    expect(registerResponse.statusCode).toBe(201);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      body: {
        email: `score_${unique}@example.com`,
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
        name: `Score Game ${unique}`,
        slug: `score-game-${unique}`,
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
            { name: { contains: `Score Game ${unique}` } },
            { slug: { contains: `score-game-${unique}` } },
          ],
        },
      });
      await app.prisma.user.deleteMany({
        where: {
          OR: [
            { username: { contains: `scoreuser_${unique}` } },
            { email: { contains: `score_${unique}` } },
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

  describe("POST /api/v1/games/:gameId/scores", () => {
    it("should submit a score successfully", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          score: 1500,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.score).toBeDefined();
      expect(body.score.gameId).toBe(gameId);
      expect(body.score.userId).toBe(userId);
      expect(body.score.score).toBe(1500);
      expect(body.score.id).toBeDefined();
      expect(body.score.createdAt).toBeDefined();
    });

    it("should persist every submission to PostgreSQL", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: { score: 100 },
      });

      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: { score: 250 },
      });

      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: { score: 450 },
      });

      const scores = await app.prisma.score.findMany({
        where: { gameId, userId },
        orderBy: { createdAt: "asc" },
      });

      expect(scores.length).toBeGreaterThanOrEqual(3);
      expect(scores.map((s) => s.score)).toEqual(
        expect.arrayContaining([100, 250, 450]),
      );
    });

    it("should reject negative scores", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          score: -100,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject decimal scores", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          score: 1500.75,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject missing score", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        body: {
          score: 1500,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for nonexistent game", async () => {
      const fakeGameId = "00000000-0000-0000-0000-000000000000";
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/games/${fakeGameId}/scores`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          score: 1500,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("GAME_NOT_FOUND");
    });

    it("should reject invalid game ID", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/games/not-a-uuid/scores",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          score: 1500,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("Redis best-score behavior", () => {
    it("should update Redis with the highest score", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: { score: 1500 },
      });

      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: { score: 2200 },
      });

      const member = `user:${userId}`;
      const redisScore = await app.redis.zscore(
        `leaderboard:game:${gameId}`,
        member,
      );
      expect(Number(redisScore)).toBe(2200);
    });

    it("should not overwrite a higher score with a lower score", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameId}/scores`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: { score: 1800 },
      });

      const member = `user:${userId}`;
      const redisScore = await app.redis.zscore(
        `leaderboard:game:${gameId}`,
        member,
      );
      expect(Number(redisScore)).toBe(2200);
    });
  });

  describe("GET /api/v1/games/:gameId/scores/history", () => {
    it("should return score history from PostgreSQL", async () => {
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
        url: `/api/v1/games/${gameId}/scores/history?limit=10`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.gameId).toBe(gameId);
      expect(body.items.length).toBeGreaterThanOrEqual(3);
      const scores = body.items.map((item: { score: number }) => item.score);
      expect(scores).toContain(1000);
      expect(scores).toContain(1500);
      expect(scores).toContain(1200);
      expect(body.items[0].createdAt).toBeDefined();
      expect(body.pagination.totalItems).toBeGreaterThanOrEqual(3);
    });

    it("should isolate scores by game", async () => {
      const otherGameResponse = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: { authorization: `Bearer ${authToken}` },
        body: { name: `Other Game ${unique}`, slug: `other-game-${unique}` },
      });
      expect(otherGameResponse.statusCode).toBe(201);
      const otherGameBody = JSON.parse(otherGameResponse.body);
      const otherGameId = otherGameBody.game.id;

      await app.inject({
        method: "POST",
        url: `/api/v1/games/${otherGameId}/scores`,
        headers: { authorization: `Bearer ${authToken}` },
        body: { score: 9999 },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}/scores/history`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(
        body.items.every((item: { score: number }) => item.score !== 9999),
      ).toBe(true);
    });

    it("should paginate with default page and limit", async () => {
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: "POST",
          url: `/api/v1/games/${gameId}/scores`,
          headers: { authorization: `Bearer ${authToken}` },
          body: { score: 1000 + i },
        });
      }

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}/scores/history?page=1&limit=2`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(2);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.totalItems).toBeGreaterThanOrEqual(8);
      expect(body.pagination.totalPages).toBeGreaterThanOrEqual(4);
    });

    it("should return correct second page", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}/scores/history?page=2&limit=2`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(2);
      expect(body.pagination.page).toBe(2);
    });

    it("should return empty items for page beyond last page", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}/scores/history?page=999&limit=20`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(0);
      expect(body.pagination.totalItems).toBeGreaterThanOrEqual(8);
    });

    it("should filter by from date", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}/scores/history?from=2000-01-01`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items.length).toBeGreaterThan(0);
    });

    it("should return 200 for valid game with no score history", async () => {
      const emptyGameResponse = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: { authorization: `Bearer ${authToken}` },
        body: { name: `Empty Game ${unique}`, slug: `empty-game-${unique}` },
      });
      expect(emptyGameResponse.statusCode).toBe(201);
      const emptyGameBody = JSON.parse(emptyGameResponse.body);
      const emptyGameId = emptyGameBody.game.id;

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${emptyGameId}/scores/history`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(0);
      expect(body.pagination.totalItems).toBe(0);
      expect(body.pagination.totalPages).toBe(0);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}/scores/history`,
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for nonexistent game", async () => {
      const fakeGameId = "00000000-0000-0000-0000-000000000000";
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${fakeGameId}/scores/history`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("GAME_NOT_FOUND");
    });

    it("should return 400 for invalid game UUID", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/games/not-a-uuid/scores/history",
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid page values", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}/scores/history?page=0`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject limit greater than 100", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}/scores/history?limit=101`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 when from > to", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}/scores/history?from=2026-08-10&to=2026-08-01`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should preserve all historical records while Redis retains only best score", async () => {
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

      const historyResponse = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}/scores/history?limit=10`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(historyResponse.statusCode).toBe(200);
      const historyBody = JSON.parse(historyResponse.body);
      const historyScores = historyBody.items.map(
        (item: { score: number }) => item.score,
      );
      expect(historyScores).toContain(1000);
      expect(historyScores).toContain(1500);
      expect(historyScores).toContain(1200);

      const member = `user:${userId}`;
      const redisScore = await app.redis.zscore(
        `leaderboard:game:${gameId}`,
        member,
      );
      expect(Number(redisScore)).toBeGreaterThanOrEqual(1500);
    });

    it("should filter by from and to date range", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}/scores/history?from=2000-01-01&to=2099-12-31`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items.length).toBeGreaterThan(0);
    });
  });
});
