import { ScoreRepository } from "../repositories/score.repository";
import { GameRepository } from "../repositories/game.repository";
import { LeaderboardRedisService } from "./leaderboard-redis.service";
import { badRequest, notFound } from "../utils/errors";

type SafeScore = {
  id: string;
  gameId: string;
  userId: string;
  score: number;
  createdAt: Date;
};

type ScoreHistoryItem = {
  score: number;
  createdAt: string;
};

type ScoreHistoryResponse = {
  gameId: string;
  items: ScoreHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

export class ScoreService {
  constructor(
    private readonly scoreRepository: ScoreRepository,
    private readonly gameRepository: GameRepository,
    private readonly leaderboardRedisService: LeaderboardRedisService,
  ) {}

  async submitScore(
    userId: string,
    gameId: string,
    score: number,
  ): Promise<SafeScore> {
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw notFound("GAME_NOT_FOUND", "Game not found.");
    }

    const createdScore = await this.scoreRepository.create({
      userId,
      gameId,
      score,
    });

    try {
      await this.leaderboardRedisService.updateBestScore(gameId, userId, score);
    } catch {
      if (typeof console !== "undefined") {
        console.warn(
          `[leaderboard] Failed to update Redis leaderboard for game ${gameId}, user ${userId}`,
        );
      }
    }

    return {
      id: createdScore.id,
      gameId: createdScore.gameId,
      userId: createdScore.userId,
      score: createdScore.score,
      createdAt: createdScore.createdAt,
    };
  }

  async getHistory(
    gameId: string,
    page: number,
    limit: number,
    from?: string,
    to?: string,
  ): Promise<ScoreHistoryResponse> {
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw notFound("GAME_NOT_FOUND", "Game not found.");
    }

    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    if (fromDate && isNaN(fromDate.getTime())) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    if (toDate && isNaN(toDate.getTime())) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    if (fromDate && toDate && fromDate > toDate) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const toExclusive = toDate
      ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
      : undefined;

    const { scores, total } = await this.scoreRepository.findHistory(gameId, {
      page,
      limit,
      from: fromDate,
      to: toExclusive,
    });

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      gameId,
      items: scores.map((s) => ({
        score: s.score,
        createdAt: s.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages,
      },
    };
  }
}
