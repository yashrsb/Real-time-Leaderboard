import type { PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import type { Env } from "../config/env";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    env: Env;
  }

  interface FastifyRequest {
    user?: {
      id: string;
    };
  }
}
