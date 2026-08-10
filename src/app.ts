import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "./db/prisma";
import { createRedis } from "./db/redis";
import { loadEnv } from "./config/index";
import { errorHandler, notFoundHandler } from "./middleware/index";
import { healthRoutes } from "./routes/health.routes";

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv();

  const app: FastifyInstance = Fastify({
    logger: {
      level: env.NODE_ENV === "development" ? "info" : "warn",
      transport:
        env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
              },
            }
          : undefined,
    },
    requestIdHeader: "x-request-id",
    genReqId: () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  app.register(healthRoutes);

  app.register(import("@fastify/cors"), {
    origin: env.NODE_ENV === "development" ? true : false,
  });

  app.decorate("prisma", getPrisma());
  const redis = createRedis(env.REDIS_URL);
  app.decorate("redis", redis);

  return app;
}
