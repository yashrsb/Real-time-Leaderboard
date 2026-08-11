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
}
