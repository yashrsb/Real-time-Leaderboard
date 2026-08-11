import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { GameService } from "../services/game.service";
import { conflict, badRequest } from "../utils/errors";

const gameSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format"),
  description: z.string().max(500).optional(),
});

export class GameController {
  constructor(private readonly gameService: GameService) {}

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = gameSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const { name, slug, description } = parsed.data;

    try {
      const game = await this.gameService.createGame({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description?.trim() ?? null,
      });
      return reply.status(201).send({ game });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw conflict(
          "GAME_SLUG_ALREADY_EXISTS",
          "A game with this slug already exists.",
        );
      }
      throw error;
    }
  }

  async list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const games = await this.gameService.listGames();
    return reply.send({ games });
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { gameId } = request.params as { gameId: string };

    const idSchema = z.string().uuid();
    const idParsed = idSchema.safeParse(gameId);
    if (!idParsed.success) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const game = await this.gameService.getGameById(gameId);
    return reply.send({ game });
  }
}
