import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../../src/services/auth.service";
import { UserRepository } from "../../src/repositories/user.repository";
import { hashPassword } from "../../src/utils/password";
import type { User } from "@prisma/client";

const mockEnv = {
  JWT_SECRET: "test-secret-key-that-is-long-enough-for-hs256",
  JWT_EXPIRES_IN: "15m",
  NODE_ENV: "test" as const,
  PORT: 3000,
  HOST: "0.0.0.0",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/leaderboard",
  REDIS_URL: "redis://localhost:6379",
};

const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  username: "player_one",
  email: "player@example.com",
  passwordHash: "hashed-password",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("AuthService", () => {
  let mockUserRepository: {
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByUsername: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let authService: AuthService;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findByUsername: vi.fn(),
      create: vi.fn(),
    };

    authService = new AuthService(
      mockUserRepository as unknown as UserRepository,
      mockEnv,
    );
  });

  describe("register", () => {
    it("should register a new user", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(createMockUser());

      const user = await authService.register(
        "player_one",
        "player@example.com",
        "secure-password-123",
      );

      expect(user.id).toBe("user-1");
      expect(user.username).toBe("player_one");
      expect(user.email).toBe("player@example.com");
    });

    it("should normalize email and username", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(createMockUser());

      await authService.register(
        "  Player_One  ",
        "  Player@Example.COM  ",
        "secure-password-123",
      );

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
        "player@example.com",
      );
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(
        "Player_One",
      );
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: "Player_One",
        email: "player@example.com",
        passwordHash: expect.any(String),
      });
    });

    it("should throw if email already exists", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(createMockUser());

      await expect(
        authService.register(
          "new_user",
          "player@example.com",
          "secure-password-123",
        ),
      ).rejects.toThrow();
    });

    it("should throw if username already exists", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(
        createMockUser({ username: "player_one" }),
      );

      await expect(
        authService.register(
          "player_one",
          "new@example.com",
          "secure-password-123",
        ),
      ).rejects.toThrow();
    });
  });

  describe("login", () => {
    it("should login with valid credentials", async () => {
      const passwordHash = await hashPassword("secure-password-123");
      mockUserRepository.findByEmail.mockResolvedValue(
        createMockUser({ passwordHash }),
      );

      const result = await authService.login(
        "player@example.com",
        "secure-password-123",
      );

      expect(result.accessToken).toBeDefined();
      expect(result.tokenType).toBe("Bearer");
      expect(result.user.id).toBe("user-1");
    });

    it("should throw for invalid password", async () => {
      const passwordHash = await hashPassword("secure-password-123");
      mockUserRepository.findByEmail.mockResolvedValue(
        createMockUser({ passwordHash }),
      );

      await expect(
        authService.login("player@example.com", "wrong-password"),
      ).rejects.toThrow();
    });

    it("should throw for unknown email", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login("unknown@example.com", "secure-password-123"),
      ).rejects.toThrow();
    });
  });

  describe("getCurrentUser", () => {
    it("should return user by id", async () => {
      mockUserRepository.findById.mockResolvedValue(createMockUser());

      const user = await authService.getCurrentUser("user-1");
      expect(user.id).toBe("user-1");
    });

    it("should throw if user not found", async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.getCurrentUser("nonexistent")).rejects.toThrow();
    });
  });
});
