import type { FastifyInstance } from "fastify";
import { LeaderboardController } from "../controllers/leaderboard.controller";
import { LeaderboardService } from "../services/leaderboard.service";
import { GameRepository } from "../repositories/game.repository";
import { UserRepository } from "../repositories/user.repository";
import { LeaderboardRedisService } from "../services/leaderboard-redis.service";
import { authenticate } from "../middleware/auth";

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;
  const redis = app.redis;

  const gameRepository = new GameRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const leaderboardRedisService = new LeaderboardRedisService(redis);
  const leaderboardService = new LeaderboardService(
    gameRepository,
    userRepository,
    leaderboardRedisService,
  );
  const leaderboardController = new LeaderboardController(leaderboardService);

  app.get("/api/v1/leaderboards/:gameId", async (request, reply) => {
    return leaderboardController.getLeaderboard(request, reply);
  });

  app.get(
    "/api/v1/leaderboards/:gameId/me",
    { preHandler: authenticate },
    async (request, reply) => {
      return leaderboardController.getMyRanking(request, reply);
    },
  );
}
