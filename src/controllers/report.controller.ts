import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ReportService } from "../services/report.service";
import { badRequest, unauthorized } from "../utils/errors";

const reportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  from: z.string().min(10).max(10),
  to: z.string().min(10).max(10),
  gameId: z.string().uuid().optional(),
});

export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  async topPlayers(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = (request as FastifyRequest & { user?: { id: string } }).user
      ?.id;
    if (!userId) {
      throw unauthorized("Authentication required.");
    }

    const parsed = reportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const { page, limit, from, to, gameId } = parsed.data;

    const result = await this.reportService.getTopPlayers(
      page,
      limit,
      from,
      to,
      gameId,
    );

    return reply.status(200).send(result);
  }
}
