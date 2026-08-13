import { PrismaClient } from "@prisma/client";
import type { User } from "@prisma/client";

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async findByIds(ids: string[]): Promise<Array<{ id: string; username: string }>> {
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true },
    });
  }
}
