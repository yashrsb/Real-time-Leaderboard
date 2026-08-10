import type { FastifyReply, FastifyRequest, FastifyError } from "fastify";
import { createError } from "../utils/errors";

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const log = request.log;

  if (error.statusCode) {
    log.warn(
      { err: error, url: request.url, method: request.method },
      "Request error",
    );
  } else {
    log.error(
      { err: error, url: request.url, method: request.method },
      "Unexpected error",
    );
  }

  const statusCode = error.statusCode || 500;
  const code =
    (error as ReturnType<typeof createError>).code || "INTERNAL_SERVER_ERROR";
  const message =
    statusCode === 500 && process.env.NODE_ENV !== "development"
      ? "Internal server error"
      : error.message;

  const response = {
    error: {
      code,
      message,
    },
  };

  await reply.status(statusCode).send(response);
}
