import { PrismaClient } from "@prisma/client";

type ReportRow = {
  userId: string;
  totalScore: number;
};

type ReportRepositoryOptions = {
  page: number;
  limit: number;
  from: Date;
  toExclusive: Date;
  gameId?: string;
};

export class ReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findTopPlayers(options: ReportRepositoryOptions): Promise<ReportRow[]> {
    const { page, limit, from, toExclusive, gameId } = options;
    const skip = (page - 1) * limit;

    if (gameId) {
      return this.prisma.$queryRaw`
        SELECT "userId", SUM("score") AS "totalScore"
        FROM scores
        WHERE "gameId" = ${gameId}
          AND "createdAt" >= ${from}
          AND "createdAt" < ${toExclusive}
        GROUP BY "userId"
        ORDER BY "totalScore" DESC, "userId" ASC
        LIMIT ${limit}
        OFFSET ${skip}
      `;
    }

    return this.prisma.$queryRaw`
      SELECT "userId", SUM("score") AS "totalScore"
      FROM scores
      WHERE "createdAt" >= ${from}
        AND "createdAt" < ${toExclusive}
      GROUP BY "userId"
      ORDER BY "totalScore" DESC, "userId" ASC
      LIMIT ${limit}
      OFFSET ${skip}
    `;
  }

  async countDistinctPlayers(
    options: ReportRepositoryOptions,
  ): Promise<number> {
    const { from, toExclusive, gameId } = options;

    if (gameId) {
      const result = await this.prisma.$queryRaw`
        SELECT COUNT(DISTINCT "userId") AS "totalPlayers"
        FROM scores
        WHERE "gameId" = ${gameId}
          AND "createdAt" >= ${from}
          AND "createdAt" < ${toExclusive}
      `;
      const row = result as Array<{ totalPlayers: bigint | number }>;
      return Number(row[0].totalPlayers);
    }

    const result = await this.prisma.$queryRaw`
      SELECT COUNT(DISTINCT "userId") AS "totalPlayers"
      FROM scores
      WHERE "createdAt" >= ${from}
        AND "createdAt" < ${toExclusive}
    `;
    const row = result as Array<{ totalPlayers: bigint | number }>;
    return Number(row[0].totalPlayers);
  }
}
