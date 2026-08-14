import type { FastifyInstance } from "fastify";
import { ScoreController } from "../controllers/score.controller";
import { ScoreService } from "../services/score.service";
import { ScoreRepository } from "../repositories/score.repository";
import { GameRepository } from "../repositories/game.repository";
import { LeaderboardRedisService } from "../services/leaderboard-redis.service";
import { authenticate } from "../middleware/auth";

export async function scoreRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;
  const redis = app.redis;

  const scoreRepository = new ScoreRepository(prisma);
  const gameRepository = new GameRepository(prisma);
  const leaderboardRedisService = new LeaderboardRedisService(redis);
  const scoreService = new ScoreService(
    scoreRepository,
    gameRepository,
    leaderboardRedisService,
  );
  const scoreController = new ScoreController(scoreService);

  app.post(
    "/api/v1/games/:gameId/scores",
    { preHandler: authenticate },
    async (request, reply) => {
      return scoreController.submit(request, reply);
    },
  );

  app.get(
    "/api/v1/games/:gameId/scores/history",
    { preHandler: authenticate },
    async (request, reply) => {
      return scoreController.history(request, reply);
    },
  );
}
