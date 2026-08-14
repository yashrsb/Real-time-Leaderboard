import { PrismaClient } from "@prisma/client";
import type { Score, Prisma } from "@prisma/client";

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

  async findHistory(
    gameId: string,
    options: {
      page: number;
      limit: number;
      from?: Date;
      to?: Date;
    },
  ): Promise<{ scores: Score[]; total: number }> {
    const { page, limit, from, to } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ScoreWhereInput = { gameId };

    if (from !== undefined || to !== undefined) {
      where.createdAt = {};
      if (from !== undefined) {
        where.createdAt.gte = from;
      }
      if (to !== undefined) {
        where.createdAt.lt = to;
      }
    }

    const [scores, total] = await Promise.all([
      this.prisma.score.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
      this.prisma.score.count({ where }),
    ]);

    return { scores, total };
  }
}
