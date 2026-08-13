import type Redis from "ioredis";

const BEST_SCORE_LUA = `
local key = KEYS[1]
local member = ARGV[1]
local newScore = ARGV[2]

local existing = redis.call('ZSCORE', key, member)
if not existing then
  redis.call('ZADD', key, newScore, member)
  return newScore
end

local current = tonumber(existing)
local score = tonumber(newScore)
if score > current then
  redis.call('ZADD', key, score, member)
  return score
end

return current
`;

export class LeaderboardRedisService {
  constructor(private readonly redis: Redis) {}

  getGameLeaderboardKey(gameId: string): string {
    return `leaderboard:game:${gameId}`;
  }

  getMemberKey(userId: string): string {
    return `user:${userId}`;
  }

  async updateBestScore(
    gameId: string,
    userId: string,
    score: number,
  ): Promise<number> {
    const key = this.getGameLeaderboardKey(gameId);
    const member = this.getMemberKey(userId);

    const result = await this.redis.eval(
      BEST_SCORE_LUA,
      1,
      key,
      member,
      String(score),
    );
    return result as number;
  }

  async getTopPlayers(
    gameId: string,
    limit: number,
  ): Promise<{ userId: string; score: number }[]> {
    return this.getLeaderboardPage(gameId, 0, Math.max(0, limit - 1));
  }

  async getLeaderboardPage(
    gameId: string,
    start: number,
    stop: number,
  ): Promise<{ userId: string; score: number }[]> {
    const key = this.getGameLeaderboardKey(gameId);

    const raw = await this.redis.zrevrange(key, start, stop, "WITHSCORES");

    const players: { userId: string; score: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const member = raw[i];
      const score = raw[i + 1];
      if (member && score) {
        const userId = member.replace(/^user:/, "");
        players.push({ userId, score: Number(score) });
      }
    }
    return players;
  }

  async getUserScore(gameId: string, userId: string): Promise<number | null> {
    const key = this.getGameLeaderboardKey(gameId);
    const member = this.getMemberKey(userId);

    // ZSCORE: retrieve one user's current best score
    const raw = await this.redis.zscore(key, member);
    return raw ? Number(raw) : null;
  }

  async getUserRank(gameId: string, userId: string): Promise<number | null> {
    const key = this.getGameLeaderboardKey(gameId);
    const member = this.getMemberKey(userId);

    // ZREVRANK: retrieve one user's zero-based rank
    const raw = await this.redis.zrevrank(key, member);
    return raw !== null && raw !== undefined ? raw : null;
  }

  async getPlayerCount(gameId: string): Promise<number> {
    const key = this.getGameLeaderboardKey(gameId);

    // ZCARD: retrieve total number of leaderboard members
    return await this.redis.zcard(key);
  }
}
