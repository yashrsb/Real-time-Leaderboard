import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../../src/app";
import { resetEnvCache } from "../../src/config/index";
import type { Env } from "../../src/config/env";

const unique = Date.now().toString(36);

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

      await app.close();
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
});
