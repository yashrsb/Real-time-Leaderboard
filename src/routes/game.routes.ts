import type { FastifyInstance } from "fastify";
import { GameController } from "../controllers/game.controller";
import { GameService } from "../services/game.service";
import { GameRepository } from "../repositories/game.repository";
import { authenticate } from "../middleware/auth";

export async function gameRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;
  const gameRepository = new GameRepository(prisma);
  const gameService = new GameService(gameRepository);
  const gameController = new GameController(gameService);

  app.post(
    "/api/v1/games",
    { preHandler: authenticate },
    async (request, reply) => {
      return gameController.create(request, reply);
    },
  );

  app.get("/api/v1/games", async (request, reply) => {
    return gameController.list(request, reply);
  });

  app.get("/api/v1/games/:gameId", async (request, reply) => {
    return gameController.getById(request, reply);
  });
}
