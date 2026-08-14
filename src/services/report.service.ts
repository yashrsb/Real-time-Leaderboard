import { ReportRepository } from "../repositories/report.repository";
import { GameRepository } from "../repositories/game.repository";
import { UserRepository } from "../repositories/user.repository";
import { badRequest, notFound } from "../utils/errors";

type TopPlayersReportEntry = {
  rank: number;
  userId: string;
  username: string;
  score: number;
};

type TopPlayersReportResponse = {
  from: string;
  to: string;
  gameId: string | null;
  entries: TopPlayersReportEntry[];
  pagination: {
    page: number;
    limit: number;
    totalPlayers: number;
    totalPages: number;
  };
};

export class ReportService {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly gameRepository: GameRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getTopPlayers(
    page: number,
    limit: number,
    from: string,
    to: string,
    gameId?: string,
  ): Promise<TopPlayersReportResponse> {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime())) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    if (isNaN(toDate.getTime())) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    if (fromDate > toDate) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const toExclusive = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);

    let validatedGameId: string | undefined;
    if (gameId) {
      const idSchema =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!idSchema.test(gameId)) {
        throw badRequest("VALIDATION_ERROR", "Invalid request.");
      }

      const game = await this.gameRepository.findById(gameId);
      if (!game) {
        throw notFound("GAME_NOT_FOUND", "Game not found.");
      }

      validatedGameId = gameId;
    }

    const [rows, totalPlayers] = await Promise.all([
      this.reportRepository.findTopPlayers({
        page,
        limit,
        from: fromDate,
        toExclusive,
        gameId: validatedGameId,
      }),
      this.reportRepository.countDistinctPlayers({
        page,
        limit,
        from: fromDate,
        toExclusive,
        gameId: validatedGameId,
      }),
    ]);

    const userIds = rows.map((row) => row.userId);
    const users = await this.userRepository.findByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u.username]));

    const entries: TopPlayersReportEntry[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const username = userMap.get(row.userId);

      if (!username) {
        if (typeof console !== "undefined") {
          console.warn(
            `[report] Orphaned user for report: user ${row.userId} not found in PostgreSQL`,
          );
        }
        continue;
      }

      entries.push({
        rank: (page - 1) * limit + i + 1,
        userId: row.userId,
        username,
        score: Number(row.totalScore),
      });
    }

    const totalPages = totalPlayers > 0 ? Math.ceil(totalPlayers / limit) : 0;

    return {
      from: fromDate.toISOString().split("T")[0],
      to: toDate.toISOString().split("T")[0],
      gameId: validatedGameId ?? null,
      entries,
      pagination: {
        page,
        limit,
        totalPlayers,
        totalPages,
      },
    };
  }
}
