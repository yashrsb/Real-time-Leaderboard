import { PrismaClient } from "@prisma/client";
import type { Score } from "@prisma/client";

export class ScoreRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    userId: string;
    gameId: string;
    score: number;
  }): Promise<Score> {
    return this.prisma.score.create({
      data,
    });
  }
}
