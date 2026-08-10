import type { FastifyInstance } from "fastify";
import { getHealth } from "../controllers/health.controller";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/health", async (_request, reply) => {
    const result = await getHealth(app.prisma, app.redis);
    const statusCode = result.status === "ok" ? 200 : 503;
    return reply.status(statusCode).send(result);
  });
}
