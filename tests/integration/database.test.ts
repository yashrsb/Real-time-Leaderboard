import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const unique = Date.now().toString(36);

describe("Database Model — User", () => {
  it("should create a user with required fields", async () => {
    const user = await prisma.user.create({
      data: {
        username: `testuser_${unique}`,
        email: `test_${unique}@example.com`,
        passwordHash: "$2a$10$fakehash",
      },
    });

    expect(user.id).toBeDefined();
    expect(user.username).toBe(`testuser_${unique}`);
    expect(user.email).toBe(`test_${unique}@example.com`);
    expect(user.passwordHash).toBe("$2a$10$fakehash");
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it("should enforce unique username", async () => {
    const username = `uniqueuser_${unique}`;
    await prisma.user.create({
      data: {
        username,
        email: `unique1_${unique}@example.com`,
        passwordHash: "$2a$10$fakehash",
      },
    });

    await expect(
      prisma.user.create({
        data: {
          username,
          email: `unique2_${unique}@example.com`,
          passwordHash: "$2a$10$fakehash",
        },
      }),
    ).rejects.toThrow();

    await prisma.user.deleteMany({
      where: { username },
    });
  });

  it("should enforce unique email", async () => {
    const email = `uniqueemail_${unique}@example.com`;
    await prisma.user.create({
      data: {
        username: `uniqueemailuser_${unique}`,
        email,
        passwordHash: "$2a$10$fakehash",
      },
    });

    await expect(
      prisma.user.create({
        data: {
          username: `uniqueemailuser2_${unique}`,
          email,
          passwordHash: "$2a$10$fakehash",
        },
      }),
    ).rejects.toThrow();

    await prisma.user.deleteMany({
      where: { email },
    });
  });
});

describe("Database Model — Game", () => {
  it("should create a game with required fields", async () => {
    const game = await prisma.game.create({
      data: {
        name: "Test Game",
        slug: `test-game_${unique}`,
        description: "A test game",
      },
    });

    expect(game.id).toBeDefined();
    expect(game.name).toBe("Test Game");
    expect(game.slug).toBe(`test-game_${unique}`);
    expect(game.description).toBe("A test game");
  });

  it("should allow game without description", async () => {
    const game = await prisma.game.create({
      data: {
        name: "No Desc Game",
        slug: `no-desc-game_${unique}`,
      },
    });

    expect(game.description).toBeNull();
  });

  it("should enforce unique slug", async () => {
    const slug = `unique-slug-game_${unique}`;
    await prisma.game.create({
      data: {
        name: "Slug Game",
        slug,
      },
    });

    await expect(
      prisma.game.create({
        data: {
          name: "Slug Game 2",
          slug,
        },
      }),
    ).rejects.toThrow();

    await prisma.game.deleteMany({
      where: { slug },
    });
  });
});

describe("Database Model — Score", () => {
  let testUser: { id: string };
  let testGame: { id: string };

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        username: `scoreuser_${unique}`,
        email: `scoreuser_${unique}@example.com`,
        passwordHash: "$2a$10$fakehash",
      },
    });

    testGame = await prisma.game.create({
      data: {
        name: "Score Game",
        slug: `score-game_${unique}`,
      },
    });
  });

  afterAll(async () => {
    if (testUser) {
      await prisma.score.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({
        where: { id: testUser.id },
      });
    }
    if (testGame) {
      await prisma.game.delete({
        where: { id: testGame.id },
      });
    }
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
