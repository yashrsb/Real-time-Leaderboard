import { ScoreRepository } from "../repositories/score.repository";
import { GameRepository } from "../repositories/game.repository";
import { LeaderboardRedisService } from "./leaderboard-redis.service";
import { notFound } from "../utils/errors";

type SafeScore = {
  id: string;
  gameId: string;
  userId: string;
  score: number;
  createdAt: Date;
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
      // Redis is a derived read model.
      // PostgreSQL is the source of truth.
      // Log and continue; do not roll back the score.
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
}
