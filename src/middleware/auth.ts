import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, type JwtPayload } from "../utils/jwt";
import { unauthorized } from "../utils/errors";
import type { Env } from "../config/env";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
    };
  }
}

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authorization = request.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw unauthorized("Authentication required.");
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    throw unauthorized("Authentication required.");
  }

  try {
    const env = (request.server as FastifyRequest["server"] & { env?: Env })
      .env;
    if (!env) {
      throw unauthorized("Authentication required.");
    }

    const payload: JwtPayload = verifyToken(token, env);
    request.user = { id: payload.sub };
  } catch {
    throw unauthorized("Authentication required.");
  }
}
