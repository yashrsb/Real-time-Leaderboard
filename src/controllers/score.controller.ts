import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ScoreService } from "../services/score.service";
import { badRequest, unauthorized } from "../utils/errors";

const scoreSchema = z.object({
  score: z.number().int().nonnegative().max(9_999_999_999),
});

export class ScoreController {
  constructor(private readonly scoreService: ScoreService) {}

  async submit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { gameId } = request.params as { gameId: string };

    const idSchema = z.string().uuid();
    const idParsed = idSchema.safeParse(gameId);
    if (!idParsed.success) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const parsed = scoreSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const userId = (request as FastifyRequest & { user?: { id: string } }).user
      ?.id;
    if (!userId) {
      throw unauthorized("Authentication required.");
    }

    const score = await this.scoreService.submitScore(
      userId,
      gameId,
      parsed.data.score,
    );

    return reply.status(201).send({ score });
  }
}
