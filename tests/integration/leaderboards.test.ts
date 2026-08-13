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

  const paginationUsers: Array<{ userId: string }> = [];

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
      const allUserIds = [
        userIdA,
        userIdB,
        userIdC,
        ...paginationUsers.map((u) => u.userId),
      ];

      await app.prisma.score.deleteMany({
        where: { userId: { in: allUserIds } },
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
            { username: { contains: `pageuser_${unique}` } },
            { email: { contains: `page_${unique}` } },
          ],
        },
      });

      try {
        await app.redis.del(`leaderboard:game:${gameIdA}`);
        await app.redis.del(`leaderboard:game:${gameIdB}`);
      } catch {
        // ignore redis cleanup errors
      }
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
      expect(body.entries).toHaveLength(3);
      expect(body.entries[0]).toEqual({
        rank: 1,
        userId: userIdB,
        username: `leaderuserB_${unique}`,
        score: 2200,
      });
      expect(body.entries[1]).toEqual({
        rank: 2,
        userId: userIdC,
        username: `leaderuserC_${unique}`,
        score: 1800,
      });
      expect(body.entries[2]).toEqual({
        rank: 3,
        userId: userIdA,
        username: `leaderuserA_${unique}`,
        score: 1500,
      });
      expect(body.totalPlayers).toBe(3);
      expect(body.pagination).toEqual({
        page: 1,
        limit: 20,
        totalPlayers: 3,
        totalPages: 1,
      });
    });

    it("should respect limit query parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?limit=1`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].userId).toBe(userIdB);
      expect(body.entries[0].rank).toBe(1);
    });

    it("should respect maximum limit of 100", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?limit=100`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries.length).toBeLessThanOrEqual(3);
    });

    it("should return empty array for game with no scores", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdB}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toEqual([]);
      expect(body.totalPlayers).toBe(0);
      expect(body.pagination).toEqual({
        page: 1,
        limit: 20,
        totalPlayers: 0,
        totalPages: 0,
      });
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
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].userId).toBe(userIdA);
      expect(body.entries[0].score).toBe(5000);
      expect(body.entries[0].username).toBe(`leaderuserA_${unique}`);
    });

    it("should return correct global ranks on page 2", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=2&limit=2`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].rank).toBe(3);
      expect(body.entries[0].userId).toBe(userIdA);
    });

    it("should return empty entries for page beyond last page", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=2&limit=5`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toEqual([]);
      expect(body.totalPlayers).toBe(3);
      expect(body.pagination.totalPages).toBe(1);
    });

    it("should reject invalid page values", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=0`,
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid limit values", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?limit=101`,
      });

      expect(response.statusCode).toBe(400);
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

  describe("Phase 8 — nearby players", () => {
    it("should include nearby players around authenticated user", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}/me`,
        headers: {
          authorization: `Bearer ${userAToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.userId).toBe(userIdA);
      expect(body.rank).toBe(3);
      expect(body.score).toBe(1500);
      expect(body.totalPlayers).toBe(3);
      expect(body.nearbyPlayers).toHaveLength(3);
      expect(body.nearbyPlayers[0]).toEqual({
        rank: 1,
        userId: userIdB,
        username: `leaderuserB_${unique}`,
        score: 2200,
        isCurrentUser: false,
      });
      expect(body.nearbyPlayers[1]).toEqual({
        rank: 2,
        userId: userIdC,
        username: `leaderuserC_${unique}`,
        score: 1800,
        isCurrentUser: false,
      });
      expect(body.nearbyPlayers[2]).toEqual({
        rank: 3,
        userId: userIdA,
        username: `leaderuserA_${unique}`,
        score: 1500,
        isCurrentUser: true,
      });
    });

    it("should mark current user in nearby players", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}/me`,
        headers: {
          authorization: `Bearer ${userBToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.nearbyPlayers.some((p: { isCurrentUser: boolean }) => p.isCurrentUser)).toBe(true);
      expect(body.nearbyPlayers.find((p: { userId: string }) => p.userId === userIdB).isCurrentUser).toBe(true);
    });

    it("should clamp nearby players at top boundary", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}/me`,
        headers: {
          authorization: `Bearer ${userBToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.nearbyPlayers[0].rank).toBe(1);
    });

    it("should clamp nearby players at bottom boundary", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}/me`,
        headers: {
          authorization: `Bearer ${userAToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.nearbyPlayers[body.nearbyPlayers.length - 1].rank).toBe(3);
    });

    it("should include totalPlayers from Redis", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}/me`,
        headers: {
          authorization: `Bearer ${userAToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.totalPlayers).toBe(3);
    });

    it("should return 404 for user with no score", async () => {
      const newUserResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `nearnorank_${unique}`,
          email: `nearnorank_${unique}@example.com`,
          password: "secure-password-123",
        },
      });
      expect(newUserResponse.statusCode).toBe(201);

      const newLoginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        body: {
          email: `nearnorank_${unique}@example.com`,
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
            { username: { contains: `nearnorank_${unique}` } },
            { email: { contains: `nearnorank_${unique}` } },
          ],
        },
      });
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
      expect(body.entries[0].userId).toBe(userIdA);
      expect(body.entries[0].score).toBe(2500);
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
      const topEntries = body.entries.filter(
        (e: { userId: string; score: number }) => e.score === 2500,
      );
      expect(topEntries.length).toBe(2);
    });
  });

  describe("Phase 7 — pagination", () => {
    it("Test 1 — default pagination returns 20 entries with correct ranks", async () => {
      for (let i = 0; i < 12; i++) {
        const username = `pageuser_${unique}_${i}`;
        const email = `page_${unique}_${i}@example.com`;
        const password = "secure-password-123";

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
        paginationUsers.push({ userId: loginBody.user.id });

        await app.inject({
          method: "POST",
          url: `/api/v1/games/${gameIdA}/scores`,
          headers: { authorization: `Bearer ${loginBody.accessToken}` },
          body: { score: (i + 1) * 100 },
        });
      }

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=1&limit=20`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(15);
      expect(body.entries[0].rank).toBe(1);
      expect(body.entries[14].rank).toBe(15);
      expect(body.totalPlayers).toBe(15);
      expect(body.pagination.totalPages).toBe(1);
    }, 60000);

    it("Test 2 — second page returns remaining entries with global ranks", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=2&limit=5`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(5);
      expect(body.entries[0].rank).toBe(6);
      expect(body.entries[4].rank).toBe(10);
    });

    it("Test 3 — custom limit returns correct number of entries", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=1&limit=5`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(5);
      expect(body.entries[0].rank).toBe(1);
      expect(body.entries[4].rank).toBe(5);
    });

    it("Test 4 — pagination across pages with limit=10", async () => {
      const responsePage1 = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=1&limit=10`,
      });
      const body1 = JSON.parse(responsePage1.body);
      expect(body1.entries).toHaveLength(10);
      expect(body1.entries[0].rank).toBe(1);
      expect(body1.entries[9].rank).toBe(10);

      const responsePage2 = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=2&limit=10`,
      });
      const body2 = JSON.parse(responsePage2.body);
      expect(body2.entries).toHaveLength(5);
      expect(body2.entries[0].rank).toBe(11);
      expect(body2.entries[4].rank).toBe(15);

      const responsePage3 = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=3&limit=10`,
      });
      const body3 = JSON.parse(responsePage3.body);
      expect(body3.entries).toHaveLength(0);
      expect(body3.pagination.totalPages).toBe(2);
    });

    it("Test 5 — global rank continues across pages", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=2&limit=5`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries[0].rank).toBe(6);
    });

    it("Test 6 — entries contain usernames resolved from PostgreSQL", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=1&limit=5`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      for (const entry of body.entries) {
        expect(entry.userId).toBeDefined();
        expect(entry.username).toBeDefined();
        expect(entry.username.length).toBeGreaterThan(0);
      }
    });

    it("Test 8 — totalPlayers matches Redis member count", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=1&limit=20`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.totalPlayers).toBe(15);
      expect(body.pagination.totalPlayers).toBe(15);
    });

    it("Test 11 — invalid pagination returns 400", async () => {
      const cases = [
        { page: "0", limit: "20" },
        { page: "-1", limit: "20" },
        { page: "abc", limit: "20" },
        { page: "1", limit: "0" },
        { page: "1", limit: "-1" },
        { page: "1", limit: "101" },
        { page: "1", limit: "abc" },
      ];

      for (const params of cases) {
        const response = await app.inject({
          method: "GET",
          url: `/api/v1/leaderboards/${gameIdA}?page=${params.page}&limit=${params.limit}`,
        });

        expect(response.statusCode).toBe(400);
      }
    });

    it("Test 12 — invalid game ID returns 400", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/leaderboards/not-a-uuid?page=1&limit=20",
      });

      expect(response.statusCode).toBe(400);
    });

    it("Test 13 — nonexistent game returns 404", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${fakeId}?page=1&limit=20`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("GAME_NOT_FOUND");
    });

    it("Test 14 — multiple games remain isolated", async () => {
      const responseA = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}?page=1&limit=100`,
      });
      const bodyA = JSON.parse(responseA.body);
      const usersInA = new Set(bodyA.entries.map((e: { userId: string }) => e.userId));

      const responseB = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdB}?page=1&limit=100`,
      });
      const bodyB = JSON.parse(responseB.body);
      const usersInB = new Set(bodyB.entries.map((e: { userId: string }) => e.userId));

      for (const userId of usersInB) {
        if (userId === userIdA) continue;
        expect(usersInA.has(userId)).toBe(false);
      }
    });

    it("Test 15 — higher score changes ranking", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/games/${gameIdA}/scores`,
        headers: { authorization: `Bearer ${userAToken}` },
        body: { score: 3000 },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/leaderboards/${gameIdA}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const topEntry = body.entries.find((e: { userId: string }) => e.userId === userIdA);
      expect(topEntry).toBeDefined();
      expect(topEntry.score).toBe(3000);
    });

    it("Test 16 — lower score does not change leaderboard score", async () => {
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
      expect(body.score).toBe(3000);
      expect(body.rank).toBe(1);
    });
  });
});
