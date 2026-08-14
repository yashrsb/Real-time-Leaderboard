import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ScoreService } from "../services/score.service";
import { badRequest, unauthorized } from "../utils/errors";

const scoreSchema = z.object({
  score: z.number().int().nonnegative().max(9_999_999_999),
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  from: z.string().optional(),
  to: z.string().optional(),
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

  async history(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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

    const queryParsed = historyQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const { page, limit, from, to } = queryParsed.data;

    const result = await this.scoreService.getHistory(
      gameId,
      page,
      limit,
      from,
      to,
    );

    return reply.status(200).send(result);
  }
}
