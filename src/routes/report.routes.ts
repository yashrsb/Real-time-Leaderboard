import type { FastifyInstance } from "fastify";
import { ReportController } from "../controllers/report.controller";
import { ReportService } from "../services/report.service";
import { ReportRepository } from "../repositories/report.repository";
import { GameRepository } from "../repositories/game.repository";
import { UserRepository } from "../repositories/user.repository";
import { authenticate } from "../middleware/auth";

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;

  const reportRepository = new ReportRepository(prisma);
  const gameRepository = new GameRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const reportService = new ReportService(
    reportRepository,
    gameRepository,
    userRepository,
  );
  const reportController = new ReportController(reportService);

  app.get(
    "/api/v1/reports/top-players",
    { preHandler: authenticate },
    async (request, reply) => {
      return reportController.topPlayers(request, reply);
    },
  );
}
