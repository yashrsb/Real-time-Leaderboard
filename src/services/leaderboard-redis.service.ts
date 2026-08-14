import type Redis from "ioredis";

const BEST_SCORE_LUA = `
local key = KEYS[1]
local member = ARGV[1]
local newScore = ARGV[2]
local globalKey = ARGV[3]

local existing = redis.call('ZSCORE', key, member)
if not existing then
  redis.call('ZADD', key, newScore, member)
  if globalKey ~= '' then
    redis.call('ZINCRBY', globalKey, newScore, member)
  end
  return newScore
end

local current = tonumber(existing)
local score = tonumber(newScore)
if score > current then
  local delta = score - current
  redis.call('ZADD', key, score, member)
  if globalKey ~= '' then
    redis.call('ZINCRBY', globalKey, delta, member)
  end
  return score
end

return current
`;

const GLOBAL_LEADERBOARD_KEY = "leaderboard:global";

export class LeaderboardRedisService {
  constructor(private readonly redis: Redis) {}

  getGameLeaderboardKey(gameId: string): string {
    return `leaderboard:game:${gameId}`;
  }

  getMemberKey(userId: string): string {
    return `user:${userId}`;
  }

  getGlobalLeaderboardKey(): string {
    return GLOBAL_LEADERBOARD_KEY;
  }

  async updateBestScore(
    gameId: string,
    userId: string,
    score: number,
  ): Promise<number> {
    const key = this.getGameLeaderboardKey(gameId);
    const member = this.getMemberKey(userId);
    const globalKey = this.getGlobalLeaderboardKey();

    const result = await this.redis.eval(
      BEST_SCORE_LUA,
      1,
      key,
      member,
      String(score),
      globalKey,
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

  async getNearbyPlayers(
    gameId: string,
    userId: string,
    radius: number = 2,
  ): Promise<{ userId: string; score: number }[]> {
    const key = this.getGameLeaderboardKey(gameId);
    const member = this.getMemberKey(userId);

    const redisRank = await this.redis.zrevrank(key, member);
    if (redisRank === null || redisRank === undefined) {
      return [];
    }

    const start = Math.max(0, redisRank - radius);
    const stop = redisRank + radius;

    const raw = await this.redis.zrevrange(key, start, stop, "WITHSCORES");

    const players: { userId: string; score: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const member = raw[i];
      const score = raw[i + 1];
      if (member && score) {
        const parsedUserId = member.replace(/^user:/, "");
        players.push({ userId: parsedUserId, score: Number(score) });
      }
    }
    return players;
  }

  async getGlobalLeaderboardPage(
    start: number,
    stop: number,
  ): Promise<{ userId: string; score: number }[]> {
    const key = this.getGlobalLeaderboardKey();

    const raw = await this.redis.zrevrange(key, start, stop, "WITHSCORES");

    const players: { userId: string; score: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const member = raw[i];
      const score = raw[i + 1];
      if (member && score) {
        const parsedUserId = member.replace(/^user:/, "");
        players.push({ userId: parsedUserId, score: Number(score) });
      }
    }
    return players;
  }

  async getGlobalUserScore(userId: string): Promise<number | null> {
    const key = this.getGlobalLeaderboardKey();
    const member = this.getMemberKey(userId);

    const raw = await this.redis.zscore(key, member);
    return raw ? Number(raw) : null;
  }

  async getGlobalUserRank(userId: string): Promise<number | null> {
    const key = this.getGlobalLeaderboardKey();
    const member = this.getMemberKey(userId);

    const raw = await this.redis.zrevrank(key, member);
    return raw !== null && raw !== undefined ? raw : null;
  }

  async getGlobalPlayerCount(): Promise<number> {
    const key = this.getGlobalLeaderboardKey();
    return await this.redis.zcard(key);
  }
}
