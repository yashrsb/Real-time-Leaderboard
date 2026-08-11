import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/utils/password";

describe("Password Utility", () => {
  it("should hash a password", async () => {
    const hash = await hashPassword("secure-password-123");
    expect(hash).toBeDefined();
    expect(hash).not.toBe("secure-password-123");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("should verify a correct password", async () => {
    const hash = await hashPassword("secure-password-123");
    const isValid = await verifyPassword("secure-password-123", hash);
    expect(isValid).toBe(true);
  });

  it("should reject an incorrect password", async () => {
    const hash = await hashPassword("secure-password-123");
    const isValid = await verifyPassword("wrong-password", hash);
    expect(isValid).toBe(false);
  });
});
