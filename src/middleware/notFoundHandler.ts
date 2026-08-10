import type { FastifyRequest, FastifyReply } from "fastify";
import { notFound } from "../utils/errors";

export async function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const error = notFound(
    "NOT_FOUND",
    `Route ${request.method} ${request.url} not found`,
  );
  request.log.warn(
    { url: request.url, method: request.method },
    "Route not found",
  );
  await reply.status(404).send({
    error: {
      code: error.code,
      message: error.message,
    },
  });
}
