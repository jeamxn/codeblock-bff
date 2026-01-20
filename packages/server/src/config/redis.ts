import { redis, RedisClient } from 'bun';

let redisClient: typeof redis | RedisClient | null = null;

export function getRedis(): typeof redis | RedisClient {
  if (!redisClient) {
    // Bun automatically uses REDIS_URL environment variable
    // or defaults to redis://localhost:6379
    redisClient = redis;
  }
  return redisClient;
}

// Cache service with TTL support
export class CacheService {
  private redis: typeof redis | RedisClient;
  private defaultTTL: number;

  constructor(ttl: number = 300) { // default 5 minutes
    this.redis = getRedis();
    this.defaultTTL = ttl;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    const expiry = ttl ?? this.defaultTTL;

    await this.redis.set(key, serialized);
    if (expiry > 0) {
      await this.redis.expire(key, expiry);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    // Note: This is a simple implementation. For production,
    // consider using SCAN for large datasets
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      for (const key of keys) {
        await this.redis.del(key);
      }
    }
  }

  // Specific cache methods
  async getBlock(blockId: string) {
    return this.get(`block:${blockId}`);
  }

  async setBlock(blockId: string, block: unknown) {
    return this.set(`block:${blockId}`, block, 300); // 5 min
  }

  async getFlow(flowId: string) {
    return this.get(`flow:${flowId}`);
  }

  async setFlow(flowId: string, flow: unknown) {
    return this.set(`flow:${flowId}`, flow, 300); // 5 min
  }

  async getFlowBySlug(slug: string) {
    return this.get(`flow:slug:${slug}`);
  }

  async setFlowBySlug(slug: string, flow: unknown) {
    return this.set(`flow:slug:${slug}`, flow, 300); // 5 min
  }

  async getOpenApiSpec(url: string) {
    const hash = Bun.hash(url).toString(16);
    return this.get(`openapi:${hash}`);
  }

  async setOpenApiSpec(url: string, spec: unknown) {
    const hash = Bun.hash(url).toString(16);
    return this.set(`openapi:${hash}`, spec, 600); // 10 min
  }

  async invalidateFlow(flowId: string, slug: string) {
    await Promise.all([
      this.del(`flow:${flowId}`),
      this.del(`flow:slug:${slug}`),
    ]);
  }

  async invalidateBlock(blockId: string) {
    await this.del(`block:${blockId}`);
  }
}

export const cacheService = new CacheService();
