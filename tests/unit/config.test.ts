import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { loadEnv, resetEnvCache } from "@src/config/index";

describe("Environment Configuration", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/leaderboard";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.JWT_SECRET = "test-secret-key-that-is-long-enough-for-hs256";
  });

  afterEach(() => {
    resetEnvCache();
  });

  it("should load valid environment variables", () => {
    const env = loadEnv();
    expect(env.NODE_ENV).toBe("test");
    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe("0.0.0.0");
    expect(env.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5432/leaderboard",
    );
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
    expect(env.JWT_SECRET).toBe(
      "test-secret-key-that-is-long-enough-for-hs256",
    );
  });

  it("should coerce PORT to number", () => {
    process.env.PORT = "4000";
    const env = loadEnv();
    expect(env.PORT).toBe(4000);
    delete process.env.PORT;
  });

  it("should throw for missing required variables", () => {
    const originalDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    expect(() => {
      loadEnv();
    }).toThrow("Invalid environment variables");

    process.env.DATABASE_URL = originalDb;
  });
});
