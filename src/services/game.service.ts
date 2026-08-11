import { GameRepository } from "../repositories/game.repository";
import { conflict, notFound } from "../utils/errors";

type SafeGame = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class GameService {
  constructor(private readonly gameRepository: GameRepository) {}

  async createGame(data: {
    name: string;
    slug: string;
    description?: string | null;
  }): Promise<SafeGame> {
    const existingSlug = await this.gameRepository.findBySlug(data.slug);
    if (existingSlug) {
      throw conflict(
        "GAME_SLUG_ALREADY_EXISTS",
        "A game with this slug already exists.",
      );
    }

    const game = await this.gameRepository.create({
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
    });

    return {
      id: game.id,
      name: game.name,
      slug: game.slug,
      description: game.description,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    };
  }

  async listGames(): Promise<SafeGame[]> {
    const games = await this.gameRepository.findAll();
    return games.map((game) => ({
      id: game.id,
      name: game.name,
      slug: game.slug,
      description: game.description,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    }));
  }

  async getGameById(id: string): Promise<SafeGame> {
    const game = await this.gameRepository.findById(id);
    if (!game) {
      throw notFound("GAME_NOT_FOUND", "Game not found.");
    }

    return {
      id: game.id,
      name: game.name,
      slug: game.slug,
      description: game.description,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    };
  }
}
