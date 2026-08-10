import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("Database Model — User", () => {
  it("should create a user with required fields", async () => {
    const user = await prisma.user.create({
      data: {
        username: "testuser",
        email: "test@example.com",
        passwordHash: "$2a$10$fakehash",
      },
    });

    expect(user.id).toBeDefined();
    expect(user.username).toBe("testuser");
    expect(user.email).toBe("test@example.com");
    expect(user.passwordHash).toBe("$2a$10$fakehash");
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it("should enforce unique username", async () => {
    await prisma.user.create({
      data: {
        username: "uniqueuser",
        email: "unique1@example.com",
        passwordHash: "$2a$10$fakehash",
      },
    });

    await expect(
      prisma.user.create({
        data: {
          username: "uniqueuser",
          email: "unique2@example.com",
          passwordHash: "$2a$10$fakehash",
        },
      }),
    ).rejects.toThrow();

    await prisma.user.deleteMany({
      where: { username: "uniqueuser" },
    });
  });

  it("should enforce unique email", async () => {
    await prisma.user.create({
      data: {
        username: "uniqueemailuser",
        email: "uniqueemail@example.com",
        passwordHash: "$2a$10$fakehash",
      },
    });

    await expect(
      prisma.user.create({
        data: {
          username: "uniqueemailuser2",
          email: "uniqueemail@example.com",
          passwordHash: "$2a$10$fakehash",
        },
      }),
    ).rejects.toThrow();

    await prisma.user.deleteMany({
      where: { email: "uniqueemail@example.com" },
    });
  });
});

describe("Database Model — Game", () => {
  it("should create a game with required fields", async () => {
    const game = await prisma.game.create({
      data: {
        name: "Test Game",
        slug: "test-game",
        description: "A test game",
      },
    });

    expect(game.id).toBeDefined();
    expect(game.name).toBe("Test Game");
    expect(game.slug).toBe("test-game");
    expect(game.description).toBe("A test game");
  });

  it("should allow game without description", async () => {
    const game = await prisma.game.create({
      data: {
        name: "No Desc Game",
        slug: "no-desc-game",
      },
    });

    expect(game.description).toBeNull();
  });

  it("should enforce unique slug", async () => {
    await prisma.game.create({
      data: {
        name: "Slug Game",
        slug: "unique-slug-game",
      },
    });

    await expect(
      prisma.game.create({
        data: {
          name: "Slug Game 2",
          slug: "unique-slug-game",
        },
      }),
    ).rejects.toThrow();

    await prisma.game.deleteMany({
      where: { slug: "unique-slug-game" },
    });
  });
});

describe("Database Model — Score", () => {
  let testUser: { id: string };
  let testGame: { id: string };

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        username: "scoreuser",
        email: "scoreuser@example.com",
        passwordHash: "$2a$10$fakehash",
      },
    });

    testGame = await prisma.game.create({
      data: {
        name: "Score Game",
        slug: "score-game",
      },
    });
  });

  afterAll(async () => {
    await prisma.score.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.game.delete({
      where: { id: testGame.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });
  });

  it("should create a score referencing valid user and game", async () => {
    const score = await prisma.score.create({
      data: {
        userId: testUser.id,
        gameId: testGame.id,
        score: 100,
      },
    });

    expect(score.id).toBeDefined();
    expect(score.userId).toBe(testUser.id);
    expect(score.gameId).toBe(testGame.id);
    expect(score.score).toBe(100);
    expect(score.createdAt).toBeInstanceOf(Date);
  });

  it("should reject score with nonexistent user", async () => {
    const fakeUserId = "00000000-0000-0000-0000-000000000000";

    await expect(
      prisma.score.create({
        data: {
          userId: fakeUserId,
          gameId: testGame.id,
          score: 100,
        },
      }),
    ).rejects.toThrow();
  });

  it("should reject score with nonexistent game", async () => {
    const fakeGameId = "00000000-0000-0000-0000-000000000000";

    await expect(
      prisma.score.create({
        data: {
          userId: testUser.id,
          gameId: fakeGameId,
          score: 100,
        },
      }),
    ).rejects.toThrow();
  });

  it("should allow multiple scores for the same user and game", async () => {
    await prisma.score.create({
      data: {
        userId: testUser.id,
        gameId: testGame.id,
        score: 200,
      },
    });

    await prisma.score.create({
      data: {
        userId: testUser.id,
        gameId: testGame.id,
        score: 300,
      },
    });

    const scores = await prisma.score.findMany({
      where: {
        userId: testUser.id,
        gameId: testGame.id,
      },
      orderBy: { createdAt: "asc" },
    });

    expect(scores).toHaveLength(3);
    expect(scores[0]?.score).toBe(100);
    expect(scores[1]?.score).toBe(200);
    expect(scores[2]?.score).toBe(300);
  });
});
