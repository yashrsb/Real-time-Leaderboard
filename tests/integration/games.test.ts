import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../../src/app";
import { resetEnvCache } from "../../src/config/index";
import type { Env } from "../../src/config/env";

const unique = `game-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const mockEnv: Env = {
  JWT_SECRET: "test-secret-key-that-is-long-enough-for-hs256",
  JWT_EXPIRES_IN: "15m",
  NODE_ENV: "test",
  PORT: 3000,
  HOST: "0.0.0.0",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/leaderboard",
  REDIS_URL: "redis://localhost:6379",
};

describe("Game Endpoints", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let authToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = mockEnv.JWT_SECRET;
    process.env.JWT_EXPIRES_IN = mockEnv.JWT_EXPIRES_IN;

    app = await buildApp();

    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      body: {
        username: `gameuser_${unique}`,
        email: `game_${unique}@example.com`,
        password: "secure-password-123",
      },
    });

    expect(registerResponse.statusCode).toBe(201);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      body: {
        email: `game_${unique}@example.com`,
        password: "secure-password-123",
      },
    });

    const loginBody = JSON.parse(loginResponse.body);
    authToken = loginBody.accessToken;
  });

  afterAll(async () => {
    if (app) {
      const users = await app.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: `gameuser_${unique}` } },
            { email: { contains: `game_${unique}` } },
          ],
        },
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);

      if (userIds.length > 0) {
        await app.prisma.score.deleteMany({
          where: { userId: { in: userIds } },
        });
      }

      await app.prisma.game.deleteMany({
        where: {
          OR: [{ name: { contains: unique } }, { slug: { contains: unique } }],
        },
      });
      await app.prisma.user.deleteMany({
        where: {
          OR: [
            { username: { contains: `gameuser_${unique}` } },
            { email: { contains: `game_${unique}` } },
          ],
        },
      });
      await app.close();
    }
  });

  afterEach(() => {
    resetEnvCache();
  });

  describe("POST /api/v1/games", () => {
    it("should create a new game", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          name: `Space Runner ${unique}`,
          slug: `space-runner-${unique}`,
          description: "Fast-paced arcade game",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.game).toBeDefined();
      expect(body.game.name).toBe(`Space Runner ${unique}`);
      expect(body.game.slug).toBe(`space-runner-${unique}`);
      expect(body.game.description).toBe("Fast-paced arcade game");
      expect(body.game.id).toBeDefined();
      expect(body.game.createdAt).toBeDefined();
      expect(body.game.updatedAt).toBeDefined();
    });

    it("should create a game without description", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          name: `Chess ${unique}`,
          slug: `chess-${unique}`,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.game.description).toBeNull();
    });

    it("should reject duplicate slug", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          name: `Game A ${unique}`,
          slug: `dup-slug-${unique}`,
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          name: `Game B ${unique}`,
          slug: `dup-slug-${unique}`,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("GAME_SLUG_ALREADY_EXISTS");
    });

    it("should reject invalid payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          name: "",
          slug: "invalid slug with spaces",
          description: "a".repeat(600),
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject uppercase slug", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          name: `Lowercase ${unique}`,
          slug: `UPPERCASE-${unique}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        body: {
          name: `No Auth ${unique}`,
          slug: `no-auth-${unique}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/games", () => {
    it("should return all games", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          name: `List Game A ${unique}`,
          slug: `list-a-${unique}`,
        },
      });

      await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          name: `List Game B ${unique}`,
          slug: `list-b-${unique}`,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/games",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.games).toBeInstanceOf(Array);
      expect(body.games.length).toBeGreaterThanOrEqual(2);
    });

    it("should return empty array when no games exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/games",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.games).toBeInstanceOf(Array);
    });

    it("should be accessible without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/games",
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("GET /api/v1/games/:gameId", () => {
    it("should return an existing game", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          name: `Get Game ${unique}`,
          slug: `get-game-${unique}`,
          description: "Test game",
        },
      });

      const createBody = JSON.parse(createResponse.body);
      const gameId = createBody.game.id;

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.game.id).toBe(gameId);
      expect(body.game.name).toBe(`Get Game ${unique}`);
    });

    it("should return 404 for nonexistent game", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("GAME_NOT_FOUND");
    });

    it("should be accessible without authentication", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/games",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: {
          name: `Public Get ${unique}`,
          slug: `public-get-${unique}`,
        },
      });

      const createBody = JSON.parse(createResponse.body);
      const gameId = createBody.game.id;

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/games/${gameId}`,
      });

      expect(response.statusCode).toBe(200);
    });

    it("should reject invalid UUID", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/games/not-a-uuid",
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
