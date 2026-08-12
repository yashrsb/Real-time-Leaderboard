import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../../src/app";
import { resetEnvCache } from "../../src/config/index";
import type { Env } from "../../src/config/env";

const unique = `lb-${Date.now().toString(36)}`;

const mockEnv: Env = {
  JWT_SECRET: "test-secret-key-that-is-long-enough-for-hs256",
  JWT_EXPIRES_IN: "15m",
  NODE_ENV: "test",
  PORT: 3000,
  HOST: "0.0.0.0",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/leaderboard",
  REDIS_URL: "redis://localhost:6379",
};

describe("Leaderboard Endpoints", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let userAToken: string;
  let userBToken: string;
  let userCToken: string;
  let userIdA: string;
  let userIdB: string;
  let userIdC: string;
  let gameIdA: string;
  let gameIdB: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = mockEnv.JWT_SECRET;
    process.env.JWT_EXPIRES_IN = mockEnv.JWT_EXPIRES_IN;

    app = await buildApp();

    const createUserAndGame = async (
      username: string,
      email: string,
      password: string,
      gameName: string,
      gameSlug: string,
    ) => {
      const registerResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: { username, email, password },
      });
      expect(registerResponse.statusCode).toBe(201);

      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        body: { email, password },
      });
      const loginBody = JSON.parse(loginResponse.body);
      const token = loginBody.accessToken;
      const userId = loginBody.user.id;

      const createGameResponse = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: { authorization: `Bearer ${token}` },
        body: { name: gameName, slug: gameSlug },
      });
      expect(createGameResponse.statusCode).toBe(201);
      const createGameBody = JSON.parse(createGameResponse.body);

      return { token, userId, gameId: createGameBody.game.id };
    };

    const userA = await createUserAndGame(
      `leaderuserA_${unique}`,
      `leaderA_${unique}@example.com`,
      "secure-password-123",
      `Leader Game A ${unique}`,
      `leader-game-a-${unique}`,
    );
    userAToken = userA.token;
    userIdA = userA.userId;
    gameIdA = userA.gameId;

    const userB = await createUserAndGame(
      `leaderuserB_${unique}`,
      `leaderB_${unique}@example.com`,
      "secure-password-123",
      `Leader Game B ${unique}`,
      `leader-game-b-${unique}`,
    );
    userBToken = userB.token;
    userIdB = userB.userId;
    gameIdB = userB.gameId;

    const userC = await createUserAndGame(
      `leaderuserC_${unique}`,
      `leaderC_${unique}@example.com`,
      "secure-password-123",
      `Leader Game C ${unique}`,
      `leader-game-c-${unique}`,
    );
    userCToken = userC.token;
    userIdC = userC.userId;

    const submitScores = async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameIdA}/scores`,
        headers: { authorization: `Bearer ${userAToken}` },
        body: { score: 1500 },
      });
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameIdA}/scores`,
        headers: { authorization: `Bearer ${userBToken}` },
        body: { score: 2200 },
      });
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameIdA}/scores`,
        headers: { authorization: `Bearer ${userCToken}` },
        body: { score: 1800 },
      });
    };

    await submitScores();
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.prisma.score.deleteMany({
        where: {
          OR: [{ userId: userIdA }, { userId: userIdB }, { userId: userIdC }],
        },
      });
      await app.prisma.game.deleteMany({
        where: {
          OR: [
            { name: { contains: `Leader Game A ${unique}` } },
            { slug: { contains: `leader-game-a-${unique}` } },
            { name: { contains: `Leader Game B ${unique}` } },
            { slug: { contains: `leader-game-b-${unique}` } },
            { name: { contains: `Leader Game C ${unique}` } },
            { slug: { contains: `leader-game-c-${unique}` } },
          ],
        },
      });
      await app.prisma.user.deleteMany({
        where: {
          OR: [
            { username: { contains: `leaderuserA_${unique}` } },
            { email: { contains: `leaderA_${unique}` } },
            { username: { contains: `leaderuserB_${unique}` } },
            { email: { contains: `leaderB_${unique}` } },
            { username: { contains: `leaderuserC_${unique}` } },
            { email: { contains: `leaderC_${unique}` } },
          ],
        },
      });

      try {
        await app.redis.del(`leaderboard:game:${gameIdA}`);
        await app.redis.del(`leaderboard:game:${gameIdB}`);
      } catch {
        // ignore redis cleanup errors
      }

      await app.close();
    }
  });

  afterEach(() => {
    resetEnvCache();
  });

  describe("GET /api/v1/leaderboards/:gameId", () => {
    it("should return top players ordered by highest score", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.gameId).toBe(gameIdA);
      expect(body.players).toHaveLength(3);
      expect(body.players[0]).toEqual({
        rank: 1,
        userId: userIdB,
        score: 2200,
      });
      expect(body.players[1]).toEqual({
        rank: 2,
        userId: userIdC,
        score: 1800,
      });
      expect(body.players[2]).toEqual({
        rank: 3,
        userId: userIdA,
        score: 1500,
      });
      expect(body.totalPlayers).toBe(3);
    });

    it("should respect limit query parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?limit=1`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players).toHaveLength(1);
      expect(body.players[0].userId).toBe(userIdB);
    });

    it("should respect maximum limit of 100", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?limit=100`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players.length).toBeLessThanOrEqual(3);
    });

    it("should return empty array for game with no scores", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdB}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players).toEqual([]);
      expect(body.totalPlayers).toBe(0);
    });

    it("should return 404 for nonexistent game", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("GAME_NOT_FOUND");
    });

    it("should return 400 for invalid game ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/leaderboards/not-a-uuid",
      });

      expect(response.statusCode).toBe(400);
    });

    it("should be accessible without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}`,
      });

      expect(response.statusCode).toBe(200);
    });

    it("should isolate different games", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameIdB}/scores`,
        headers: { authorization: `Bearer ${userAToken}` },
        body: { score: 5000 },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdB}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players).toHaveLength(1);
      expect(body.players[0].userId).toBe(userIdA);
      expect(body.players[0].score).toBe(5000);
    });
  });

  describe("GET /api/v1/leaderboards/:gameId/me", () => {
    it("should return authenticated user ranking", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}/me`,
        headers: {
          authorization: `Bearer ${userAToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.gameId).toBe(gameIdA);
      expect(body.userId).toBe(userIdA);
      expect(body.score).toBe(1500);
      expect(body.rank).toBe(3);
      expect(body.totalPlayers).toBe(3);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}/me`,
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for user with no score", async () => {
      const newUserResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `norank_${unique}`,
          email: `norank_${unique}@example.com`,
          password: "secure-password-123",
        },
      });
      expect(newUserResponse.statusCode).toBe(201);

      const newLoginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        body: {
          email: `norank_${unique}@example.com`,
          password: "secure-password-123",
        },
      });
      const newToken = JSON.parse(newLoginResponse.body).accessToken;

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}/me`,
        headers: {
          authorization: `Bearer ${newToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("USER_NOT_RANKED");

      await app.prisma.user.deleteMany({
        where: {
          OR: [
            { username: { contains: `norank_${unique}` } },
            { email: { contains: `norank_${unique}` } },
          ],
        },
      });
    });

    it("should return 404 for nonexistent game", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${fakeId}/me`,
        headers: {
          authorization: `Bearer ${userAToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("GAME_NOT_FOUND");
    });

    it("should return 400 for invalid game ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/leaderboards/not-a-uuid/me",
        headers: {
          authorization: `Bearer ${userAToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("ranking dynamics", () => {
    it("should update ranking when a higher score is submitted", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameIdA}/scores`,
        headers: { authorization: `Bearer ${userAToken}` },
        body: { score: 2500 },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players[0].userId).toBe(userIdA);
      expect(body.players[0].score).toBe(2500);
    });

    it("should not reduce rank when a lower score is submitted", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameIdA}/scores`,
        headers: { authorization: `Bearer ${userAToken}` },
        body: { score: 1000 },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}/me`,
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.score).toBe(2500);
      expect(body.rank).toBe(1);
    });

    it("should preserve equal scores", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameIdA}/scores`,
        headers: { authorization: `Bearer ${userBToken}` },
        body: { score: 2500 },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const topPlayers = body.players.filter(
        (p: { userId: string; score: number }) => p.score === 2500,
      );
      expect(topPlayers.length).toBe(2);
    });
  });
});
