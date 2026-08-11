import type { Env } from "../config/env";
import { UserRepository } from "../repositories/user.repository";
import { hashPassword, verifyPassword } from "../utils/password";
import { generateToken, type JwtPayload } from "../utils/jwt";
import { conflict, invalidCredentials, unauthorized } from "../utils/errors";

type SafeUser = {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly env: Env,
  ) {}

  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<SafeUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    const existingEmail =
      await this.userRepository.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw conflict(
        "USER_ALREADY_EXISTS",
        "A user with the provided credentials already exists.",
      );
    }

    const existingUsername =
      await this.userRepository.findByUsername(normalizedUsername);
    if (existingUsername) {
      throw conflict(
        "USER_ALREADY_EXISTS",
        "A user with the provided credentials already exists.",
      );
    }

    const passwordHash = await hashPassword(password);

    let user;
    try {
      user = await this.userRepository.create({
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") {
        throw conflict(
          "USER_ALREADY_EXISTS",
          "A user with the provided credentials already exists.",
        );
      }
      throw error;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; tokenType: string; user: SafeUser }> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw invalidCredentials("Invalid email or password.");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw invalidCredentials("Invalid email or password.");
    }

    const payload: JwtPayload = { sub: user.id };
    const accessToken = generateToken(payload, this.env);

    return {
      accessToken,
      tokenType: "Bearer",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw unauthorized("Authentication required.");
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
