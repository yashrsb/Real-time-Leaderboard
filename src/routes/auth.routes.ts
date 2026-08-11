import type { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller";
import { AuthService } from "../services/auth.service";
import { UserRepository } from "../repositories/user.repository";
import { authenticate } from "../middleware/auth";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;
  const userRepository = new UserRepository(prisma);
  const env = (
    app as FastifyInstance & {
      env?: { JWT_SECRET: string; JWT_EXPIRES_IN: string };
    }
  ).env;

  if (!env) {
    throw new Error(
      "Environment configuration is not attached to the Fastify instance.",
    );
  }

  const authService = new AuthService(userRepository, env);
  const authController = new AuthController(authService);

  app.post("/api/v1/auth/register", async (request, reply) => {
    return authController.register(request, reply);
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    return authController.login(request, reply);
  });

  app.get(
    "/api/v1/auth/me",
    { preHandler: authenticate },
    async (request, reply) => {
      return authController.me(request, reply);
    },
  );
}
