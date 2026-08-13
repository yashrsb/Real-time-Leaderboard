import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../../src/app";
import { resetEnvCache } from "../../src/config/index";
import { generateToken } from "../../src/utils/jwt";
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

describe("Authentication Endpoints", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = mockEnv.JWT_SECRET;
    process.env.JWT_EXPIRES_IN = mockEnv.JWT_EXPIRES_IN;

    app = await buildApp();
  });

  afterAll(async () => {
    if (app) {
      const users = await app.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: unique } },
            { email: { contains: unique } },
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

      await app.prisma.user.deleteMany({
        where: {
          OR: [
            { username: { contains: unique } },
            { email: { contains: unique } },
          ],
        },
      });
    }
  });

  afterEach(() => {
    resetEnvCache();
  });

  describe("POST /api/v1/auth/register", () => {
    it("should register a new user", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `authuser_${unique}`,
          email: `auth_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.user).toBeDefined();
      expect(body.user.username).toBe(`authuser_${unique}`);
      expect(body.user.email).toBe(`auth_${unique}@example.com`);
      expect(body.user.passwordHash).toBeUndefined();
    });

    it("should reject duplicate email", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `uniqueuser_${unique}`,
          email: `unique_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `uniqueuser2_${unique}`,
          email: `unique_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("USER_ALREADY_EXISTS");
    });

    it("should reject duplicate username", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `dupuser_${unique}`,
          email: `dup1_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `dupuser_${unique}`,
          email: `dup2_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it("should reject invalid payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: "ab",
          email: "invalid-email",
          password: "short",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should normalize email and username", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `  NormUser_${unique}  `,
          email: `Norm_${unique}@Example.COM`,
          password: "secure-password-123",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.user.username).toBe(`NormUser_${unique}`);
      expect(body.user.email).toBe(`norm_${unique}@example.com`);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should login with valid credentials", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `loginuser_${unique}`,
          email: `login_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        body: {
          email: `login_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accessToken).toBeDefined();
      expect(body.tokenType).toBe("Bearer");
      expect(body.user.id).toBeDefined();
      expect(body.user.passwordHash).toBeUndefined();
    });

    it("should reject invalid password", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `badpassuser_${unique}`,
          email: `badpass_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        body: {
          email: `badpass_${unique}@example.com`,
          password: "wrong-password",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("should reject unknown email", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        body: {
          email: `unknown_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("should normalize email case on login", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `caseuser_${unique}`,
          email: `case_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        body: {
          email: `CASE_${unique}@EXAMPLE.COM`,
          password: "secure-password-123",
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("should return current user with valid token", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `meuser_${unique}`,
          email: `me_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        body: {
          email: `me_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      const loginBody = JSON.parse(loginResponse.body);
      const token = loginBody.accessToken;

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.user.id).toBeDefined();
      expect(body.user.passwordHash).toBeUndefined();
    });

    it("should reject missing token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject expired token", async () => {
      const expiredEnv = { ...mockEnv, JWT_EXPIRES_IN: "1s" };
      const token = generateToken({ sub: "user-123" }, expiredEnv);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject Basic authentication scheme", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: "Basic dXNlcjpwYXNz",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject valid token for deleted user", async () => {
      const registerResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        body: {
          username: `deleteduser_${unique}`,
          email: `deleted_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        body: {
          email: `deleted_${unique}@example.com`,
          password: "secure-password-123",
        },
      });

      const loginBody = JSON.parse(loginResponse.body);
      const token = loginBody.accessToken;

      const registerBody = JSON.parse(registerResponse.body);
      await app.prisma.user.delete({
        where: { id: registerBody.user.id },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
