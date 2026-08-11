import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { AuthService } from "../services/auth.service";
import { unauthorized, conflict, badRequest } from "../utils/errors";

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
});

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const { username, email, password } = parsed.data;

    try {
      const user = await this.authService.register(username, email, password);
      return reply.status(201).send({ user });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw conflict(
          "USER_ALREADY_EXISTS",
          "A user with the provided credentials already exists.",
        );
      }
      throw error;
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("VALIDATION_ERROR", "Invalid request.");
    }

    const { email, password } = parsed.data;

    const result = await this.authService.login(email, password);
    return reply.send(result);
  }

  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = (request as FastifyRequest & { user?: { id: string } }).user
      ?.id;
    if (!userId) {
      throw unauthorized("Authentication required.");
    }

    const user = await this.authService.getCurrentUser(userId);
    return reply.send({ user });
  }
}
