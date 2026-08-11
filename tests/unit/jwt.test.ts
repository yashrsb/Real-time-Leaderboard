import { describe, it, expect } from "vitest";
import {
  generateToken,
  verifyToken,
  type JwtPayload,
} from "../../src/utils/jwt";

const mockEnv = {
  JWT_SECRET: "test-secret-key-that-is-long-enough-for-hs256",
  JWT_EXPIRES_IN: "15m",
  NODE_ENV: "test" as const,
  PORT: 3000,
  HOST: "0.0.0.0",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/leaderboard",
  REDIS_URL: "redis://localhost:6379",
};

describe("JWT Utility", () => {
  it("should generate a valid token", () => {
    const payload: JwtPayload = { sub: "user-uuid-123" };
    const token = generateToken(payload, mockEnv);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("should verify a valid token", () => {
    const payload: JwtPayload = { sub: "user-uuid-123" };
    const token = generateToken(payload, mockEnv);
    const decoded = verifyToken(token, mockEnv);
    expect(decoded.sub).toBe("user-uuid-123");
  });

  it("should throw for an invalid token", () => {
    expect(() => verifyToken("invalid-token", mockEnv)).toThrow();
  });

  it("should throw for a token with missing sub", () => {
    const base64 = (str: string) => Buffer.from(str).toString("base64url");
    const token = `${base64(JSON.stringify({ foo: "bar" }))}.${base64(JSON.stringify({}))}.${base64(JSON.stringify({}))}`;
    expect(() => verifyToken(token, mockEnv)).toThrow();
  });

  it("should throw for an expired token", async () => {
    const expiredEnv = { ...mockEnv, JWT_EXPIRES_IN: "1s" };
    const payload: JwtPayload = { sub: "user-uuid-123" };
    const token = generateToken(payload, expiredEnv);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(() => verifyToken(token, mockEnv)).toThrow();
  });
});
