import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { LeaderboardService } from "../services/leaderboard.service";
import { badRequest, unauthorized } from "../utils/errors";

const limitSchema = z.coerce.number().int().min(1).max(100).default(10);

export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  async getLeaderboard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const { gameId } = request.params as { gameId: string };

    const idSchema = z.string().uuid();
    const idParsed = idSchema.safeParse(gameId);
    if (!idParsed.success) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const limitParsed = limitSchema.safeParse(
      (request.query as { limit?: string | number }).limit,
    );
    if (!limitParsed.success) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const result = await this.leaderboardService.getLeaderboard(
      gameId,
      limitParsed.data,
    );
    return reply.send(result);
  }

  async getMyRanking(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const { gameId } = request.params as { gameId: string };

    const idSchema = z.string().uuid();
    const idParsed = idSchema.safeParse(gameId);
    if (!idParsed.success) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const userId = (request as FastifyRequest & { user?: { id: string } }).user
      ?.id;
    if (!userId) {
      throw unauthorized("Authentication required.");
    }

    const result = await this.leaderboardService.getMyRanking(gameId, userId);
    return reply.send(result);
  }
}
