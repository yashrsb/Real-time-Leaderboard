import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const user1 = await prisma.user.upsert({
    where: { username: "player_one" },
    update: {},
    create: {
      username: "player_one",
      email: "player1@example.com",
      passwordHash: "$2a$10$fakehash1",
    },
  });

  const user2 = await prisma.user.upsert({
    where: { username: "player_two" },
    update: {},
    create: {
      username: "player_two",
      email: "player2@example.com",
      passwordHash: "$2a$10$fakehash2",
    },
  });

  const user3 = await prisma.user.upsert({
    where: { username: "player_three" },
    update: {},
    create: {
      username: "player_three",
      email: "player3@example.com",
      passwordHash: "$2a$10$fakehash3",
    },
  });

  const chess = await prisma.game.upsert({
    where: { slug: "chess" },
    update: {},
    create: {
      name: "Chess",
      slug: "chess",
      description: "Classic strategy board game",
    },
  });

  const trivia = await prisma.game.upsert({
    where: { slug: "trivia" },
    update: {},
    create: {
      name: "Trivia",
      slug: "trivia",
      description: "Test your knowledge",
    },
  });

  const spaceRunner = await prisma.game.upsert({
    where: { slug: "space-runner" },
    update: {},
    create: {
      name: "Space Runner",
      slug: "space-runner",
      description: "Endless runner in space",
    },
  });

  await prisma.score.createMany({
    data: [
      { userId: user1.id, gameId: chess.id, score: 100 },
      { userId: user1.id, gameId: chess.id, score: 250 },
      { userId: user1.id, gameId: chess.id, score: 450 },
      { userId: user2.id, gameId: chess.id, score: 300 },
      { userId: user2.id, gameId: chess.id, score: 500 },
      { userId: user3.id, gameId: trivia.id, score: 900 },
      { userId: user1.id, gameId: spaceRunner.id, score: 1500 },
      { userId: user2.id, gameId: spaceRunner.id, score: 2200 },
      { userId: user3.id, gameId: chess.id, score: 175 },
    ],
    skipDuplicates: true,
  });

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
