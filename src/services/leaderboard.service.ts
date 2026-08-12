import { GameRepository } from "../repositories/game.repository";
import { LeaderboardRedisService } from "./leaderboard-redis.service";
import { notFound, serviceUnavailable } from "../utils/errors";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  score: number;
};

export type MyRanking = {
  gameId: string;
  userId: string;
  score: number;
  rank: number;
  totalPlayers: number;
};

export class LeaderboardService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly leaderboardRedisService: LeaderboardRedisService,
  ) {}

  async getLeaderboard(
    gameId: string,
    limit: number,
  ): Promise<{
    gameId: string;
    players: LeaderboardEntry[];
    totalPlayers: number;
  }> {
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw notFound("GAME_NOT_FOUND", "Game not found.");
    }

    try {
      const [players, totalPlayers] = await Promise.all([
        this.leaderboardRedisService.getTopPlayers(gameId, limit),
        this.leaderboardRedisService.getPlayerCount(gameId),
      ]);

      return {
        gameId,
        players: players.map((player, index) => ({
          rank: index + 1,
          userId: player.userId,
          score: player.score,
        })),
        totalPlayers,
      };
    } catch {
      throw serviceUnavailable(
        "LEADERBOARD_UNAVAILABLE",
        "Leaderboard is temporarily unavailable.",
      );
    }
  }

  async getMyRanking(gameId: string, userId: string): Promise<MyRanking> {
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw notFound("GAME_NOT_FOUND", "Game not found.");
    }

    try {
      const [score, rank, totalPlayers] = await Promise.all([
        this.leaderboardRedisService.getUserScore(gameId, userId),
        this.leaderboardRedisService.getUserRank(gameId, userId),
        this.leaderboardRedisService.getPlayerCount(gameId),
      ]);

      if (score === null || rank === null) {
        throw notFound(
          "USER_NOT_RANKED",
          "User has not submitted a score for this game.",
        );
      }

      return {
        gameId,
        userId,
        score,
        rank: rank + 1,
        totalPlayers,
      };
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        throw error;
      }
      throw serviceUnavailable(
        "LEADERBOARD_UNAVAILABLE",
        "Leaderboard is temporarily unavailable.",
      );
    }
  }
}
