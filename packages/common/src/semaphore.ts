import Redis from 'ioredis';

export class Semaphore {
    private redis: Redis;
    private key: string;
    private maxCount: number;
    private timeout: number;

    constructor(redis: Redis, key: string, maxCount: number, timeout: number = 30000) {
        this.redis = redis;
        this.key = key;
        this.maxCount = maxCount;
        this.timeout = timeout;
    }

    async acquire(): Promise<string> {
        const identifier = `${Date.now()}-${Math.random()}`;
        const end = Date.now() + this.timeout;

        while (Date.now() < end) {
            // Limpiar identificadores expirados
            await this.redis.zremrangebyscore(this.key, 0, Date.now() - this.timeout);

            // Intentar adquirir el semáforo
            const currentCount = await this.redis.zcard(this.key);

            if (currentCount < this.maxCount) {
                const added = await this.redis.zadd(this.key, Date.now(), identifier);
                if (added === 1) {
                    return identifier;
                }
            }

            // Esperar antes del siguiente intento
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        throw new Error(`Failed to acquire semaphore ${this.key} within timeout`);
    }

    async release(identifier: string): Promise<boolean> {
        const removed = await this.redis.zrem(this.key, identifier);
        return removed === 1;
    }

    async getCurrentCount(): Promise<number> {
        await this.redis.zremrangebyscore(this.key, 0, Date.now() - this.timeout);
        return await this.redis.zcard(this.key);
    }

    async getAvailableCount(): Promise<number> {
        const current = await this.getCurrentCount();
        return Math.max(0, this.maxCount - current);
    }
} 