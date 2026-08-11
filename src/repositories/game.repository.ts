import { PrismaClient } from "@prisma/client";
import type { Game } from "@prisma/client";

export class GameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    name: string;
    slug: string;
    description?: string | null;
  }): Promise<Game> {
    return this.prisma.game.create({
      data,
    });
  }

  async findAll(): Promise<Game[]> {
    return this.prisma.game.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  async findById(id: string): Promise<Game | null> {
    return this.prisma.game.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Game | null> {
    return this.prisma.game.findUnique({
      where: { slug },
    });
  }
}
