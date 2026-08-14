import { GameRepository } from "../repositories/game.repository";
import { UserRepository } from "../repositories/user.repository";
import { LeaderboardRedisService } from "./leaderboard-redis.service";
import { notFound, serviceUnavailable } from "../utils/errors";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  score: number;
};

export type LeaderboardResponse = {
  gameId: string;
  entries: LeaderboardEntry[];
  totalPlayers: number;
  pagination: {
    page: number;
    limit: number;
    totalPlayers: number;
    totalPages: number;
  };
};

export type GlobalLeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  score: number;
};

export type GlobalLeaderboardResponse = {
  entries: GlobalLeaderboardEntry[];
  totalPlayers: number;
  pagination: {
    page: number;
    limit: number;
    totalPlayers: number;
    totalPages: number;
  };
};

export type GlobalMyRanking = {
  userId: string;
  score: number;
  rank: number;
  totalPlayers: number;
};

export type MyRanking = {
  gameId: string;
  userId: string;
  score: number;
  rank: number;
  totalPlayers: number;
  nearbyPlayers: Array<{
    rank: number;
    userId: string;
    username: string;
    score: number;
    isCurrentUser: boolean;
  }>;
};

export class LeaderboardService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly userRepository: UserRepository,
    private readonly leaderboardRedisService: LeaderboardRedisService,
  ) {}

  async getLeaderboard(
    gameId: string,
    page: number,
    limit: number,
  ): Promise<LeaderboardResponse> {
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw notFound("GAME_NOT_FOUND", "Game not found.");
    }

    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    try {
      const [redisEntries, totalPlayers] = await Promise.all([
        this.leaderboardRedisService.getLeaderboardPage(gameId, start, stop),
        this.leaderboardRedisService.getPlayerCount(gameId),
      ]);

      const userIds = redisEntries.map((entry) => entry.userId);
      const users = await this.userRepository.findByIds(userIds);
      const userMap = new Map(users.map((u) => [u.id, u.username]));

      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < redisEntries.length; i++) {
        const entry = redisEntries[i];
        const username = userMap.get(entry.userId);

        if (!username) {
          if (typeof console !== "undefined") {
            console.warn(
              `[leaderboard] Orphaned Redis member for game ${gameId}: user ${entry.userId} not found in PostgreSQL`,
            );
          }
          continue;
        }

        entries.push({
          rank: start + i + 1,
          userId: entry.userId,
          username,
          score: entry.score,
        });
      }

      const totalPages = totalPlayers > 0 ? Math.ceil(totalPlayers / limit) : 0;

      return {
        gameId,
        entries,
        totalPlayers,
        pagination: {
          page,
          limit,
          totalPlayers,
          totalPages,
        },
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
      const [score, redisRank, totalPlayers, nearbyPlayers] =
        await Promise.all([
          this.leaderboardRedisService.getUserScore(gameId, userId),
          this.leaderboardRedisService.getUserRank(gameId, userId),
          this.leaderboardRedisService.getPlayerCount(gameId),
          this.leaderboardRedisService.getNearbyPlayers(gameId, userId),
        ]);

      if (score === null || redisRank === null) {
        throw notFound(
          "USER_NOT_RANKED",
          "User has not submitted a score for this game.",
        );
      }

      const nearbyUserIds = nearbyPlayers.map((p) => p.userId);
      const users = await this.userRepository.findByIds(nearbyUserIds);
      const userMap = new Map(users.map((u) => [u.id, u.username]));

      const rank = redisRank + 1;
      const nearbyRadius = 2;
      const nearbyStart = Math.max(0, redisRank - nearbyRadius);

      const formattedNearbyPlayers = nearbyPlayers.map((player, index) => {
        const username = userMap.get(player.userId);
        if (!username) {
          if (typeof console !== "undefined") {
            console.warn(
              `[leaderboard] Orphaned Redis member for game ${gameId}: user ${player.userId} not found in PostgreSQL`,
            );
          }
          return null;
        }

        return {
          rank: nearbyStart + index + 1,
          userId: player.userId,
          username,
          score: player.score,
          isCurrentUser: player.userId === userId,
        };
      }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      return {
        gameId,
        userId,
        score,
        rank,
        totalPlayers,
        nearbyPlayers: formattedNearbyPlayers,
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

  async getGlobalLeaderboard(
    page: number,
    limit: number,
  ): Promise<GlobalLeaderboardResponse> {
    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    try {
      const [redisEntries, totalPlayers] = await Promise.all([
        this.leaderboardRedisService.getGlobalLeaderboardPage(start, stop),
        this.leaderboardRedisService.getGlobalPlayerCount(),
      ]);

      const userIds = redisEntries.map((entry) => entry.userId);
      const users = await this.userRepository.findByIds(userIds);
      const userMap = new Map(users.map((u) => [u.id, u.username]));

      const entries: GlobalLeaderboardEntry[] = [];
      for (let i = 0; i < redisEntries.length; i++) {
        const entry = redisEntries[i];
        const username = userMap.get(entry.userId);

        if (!username) {
          if (typeof console !== "undefined") {
            console.warn(
              `[leaderboard] Orphaned Redis member for global leaderboard: user ${entry.userId} not found in PostgreSQL`,
            );
          }
          continue;
        }

        entries.push({
          rank: start + i + 1,
          userId: entry.userId,
          username,
          score: entry.score,
        });
      }

      const totalPages = totalPlayers > 0 ? Math.ceil(totalPlayers / limit) : 0;

      return {
        entries,
        totalPlayers,
        pagination: {
          page,
          limit,
          totalPlayers,
          totalPages,
        },
      };
    } catch {
      throw serviceUnavailable(
        "LEADERBOARD_UNAVAILABLE",
        "Leaderboard is temporarily unavailable.",
      );
    }
  }

  async getGlobalMyRanking(userId: string): Promise<GlobalMyRanking> {
    try {
      const [score, redisRank, totalPlayers] = await Promise.all([
        this.leaderboardRedisService.getGlobalUserScore(userId),
        this.leaderboardRedisService.getGlobalUserRank(userId),
        this.leaderboardRedisService.getGlobalPlayerCount(),
      ]);

      if (score === null || redisRank === null) {
        throw notFound(
          "USER_NOT_RANKED",
          "User has not submitted a score for any game.",
        );
      }

      return {
        userId,
        score,
        rank: redisRank + 1,
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
