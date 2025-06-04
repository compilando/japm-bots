import { Redis } from 'ioredis';
import { BotTypeConfig, BotGroup, WorkerQueueConfig } from '@bot-core/common'; // WorkerQueueConfig importada

const BOT_TYPE_CONFIG_PREFIX = 'config:bottype:';
const ALL_BOT_TYPES_KEY = 'config:bottype:_all_types';

const BOT_GROUP_CONFIG_PREFIX = 'config:botgroup:';
const ALL_BOT_GROUPS_KEY = 'config:botgroup:_all_groups';

// Constantes para WorkerQueueConfig
const WORKER_QUEUE_CONFIG_PREFIX = 'config:wq:';
const ALL_WORKER_QUEUE_CONFIGS_KEY = 'config:wq:_all_queues';

export class ConfigService {
    private redis: Redis;

    constructor(redisClient: Redis) {
        this.redis = redisClient;
    }

    // --- BotTypeConfig Methods ---
    async saveBotTypeConfig(config: BotTypeConfig): Promise<void> {
        const key = `${BOT_TYPE_CONFIG_PREFIX}${config.botType}`;
        await this.redis.multi()
            .set(key, JSON.stringify(config))
            .sadd(ALL_BOT_TYPES_KEY, config.botType)
            .exec();
        console.log(`[ConfigService] Saved BotTypeConfig for ${config.botType}`);
    }

    async getBotTypeConfig(botType: string): Promise<BotTypeConfig | null> {
        const key = `${BOT_TYPE_CONFIG_PREFIX}${botType}`;
        const result = await this.redis.get(key);
        if (!result) {
            return null;
        }
        return JSON.parse(result) as BotTypeConfig;
    }

    async getAllBotTypeConfigs(): Promise<BotTypeConfig[]> {
        const botTypes = await this.redis.smembers(ALL_BOT_TYPES_KEY);
        if (!botTypes.length) {
            return [];
        }
        const keys = botTypes.map(type => `${BOT_TYPE_CONFIG_PREFIX}${type}`);
        const results = await this.redis.mget(keys);
        return results
            .filter(res => res !== null)
            .map(res => JSON.parse(res!) as BotTypeConfig);
    }

    async updateBotTypeConfig(botType: string, updates: Partial<BotTypeConfig>): Promise<BotTypeConfig | null> {
        const key = `${BOT_TYPE_CONFIG_PREFIX}${botType}`;
        const currentConfigStr = await this.redis.get(key);
        if (!currentConfigStr) {
            return null;
        }
        const currentConfig = JSON.parse(currentConfigStr) as BotTypeConfig;
        const updatedConfig = { ...currentConfig, ...updates, botType };

        await this.redis.set(key, JSON.stringify(updatedConfig));
        console.log(`[ConfigService] Updated BotTypeConfig for ${botType}`);
        return updatedConfig;
    }

    async deleteBotTypeConfig(botType: string): Promise<void> {
        const key = `${BOT_TYPE_CONFIG_PREFIX}${botType}`;
        const result = await this.redis.multi()
            .del(key)
            .srem(ALL_BOT_TYPES_KEY, botType)
            .exec();

        if (result && result[0] && result[0][1] === 1) {
            console.log(`[ConfigService] Deleted BotTypeConfig for ${botType}`);
        } else {
            console.log(`[ConfigService] BotTypeConfig for ${botType} not found for deletion.`);
        }
    }

    // --- BotGroup Methods ---
    async saveBotGroup(group: BotGroup): Promise<void> {
        const key = `${BOT_GROUP_CONFIG_PREFIX}${group.groupId}`;
        await this.redis.multi()
            .set(key, JSON.stringify(group))
            .sadd(ALL_BOT_GROUPS_KEY, group.groupId)
            .exec();
        console.log(`[ConfigService] Saved BotGroup ${group.groupId}`);
    }

    async getBotGroup(groupId: string): Promise<BotGroup | null> {
        const key = `${BOT_GROUP_CONFIG_PREFIX}${groupId}`;
        const result = await this.redis.get(key);
        if (!result) {
            return null;
        }
        return JSON.parse(result) as BotGroup;
    }

    async getAllBotGroups(): Promise<BotGroup[]> {
        const groupIds = await this.redis.smembers(ALL_BOT_GROUPS_KEY);
        if (!groupIds.length) {
            return [];
        }
        const keys = groupIds.map(id => `${BOT_GROUP_CONFIG_PREFIX}${id}`);
        const results = await this.redis.mget(keys);
        return results
            .filter(res => res !== null)
            .map(res => JSON.parse(res!) as BotGroup);
    }

    async updateBotGroup(groupId: string, updates: Partial<BotGroup>): Promise<BotGroup | null> {
        const key = `${BOT_GROUP_CONFIG_PREFIX}${groupId}`;
        const currentGroupStr = await this.redis.get(key);
        if (!currentGroupStr) {
            return null;
        }
        const currentGroup = JSON.parse(currentGroupStr) as BotGroup;
        const updatedGroup = { ...currentGroup, ...updates, groupId };

        await this.redis.set(key, JSON.stringify(updatedGroup));
        console.log(`[ConfigService] Updated BotGroup ${groupId}`);
        return updatedGroup;
    }

    async deleteBotGroup(groupId: string): Promise<void> {
        const key = `${BOT_GROUP_CONFIG_PREFIX}${groupId}`;
        const result = await this.redis.multi()
            .del(key)
            .srem(ALL_BOT_GROUPS_KEY, groupId)
            .exec();

        if (result && result[0] && result[0][1] === 1) {
            console.log(`[ConfigService] Deleted BotGroup ${groupId}`);
        } else {
            console.log(`[ConfigService] BotGroup ${groupId} not found for deletion.`);
        }
    }

    // --- WorkerQueueConfig Methods ---

    async saveWorkerQueueConfig(config: WorkerQueueConfig): Promise<void> {
        const key = `${WORKER_QUEUE_CONFIG_PREFIX}${config.queueName}`;
        // Asegurarse que queueName sea tratado como string y no como objeto en la clave del set
        const queueNameStr = String(config.queueName);
        await this.redis.multi()
            .set(key, JSON.stringify(config))
            .sadd(ALL_WORKER_QUEUE_CONFIGS_KEY, queueNameStr)
            .exec();
        console.log(`[ConfigService] Saved WorkerQueueConfig for queue: ${queueNameStr}`);
    }

    async getWorkerQueueConfig(queueName: string): Promise<WorkerQueueConfig | null> {
        const key = `${WORKER_QUEUE_CONFIG_PREFIX}${queueName}`;
        const result = await this.redis.get(key);
        if (!result) {
            return null;
        }
        return JSON.parse(result) as WorkerQueueConfig;
    }

    async getAllWorkerQueueConfigs(): Promise<WorkerQueueConfig[]> {
        const queueNames = await this.redis.smembers(ALL_WORKER_QUEUE_CONFIGS_KEY);
        if (!queueNames.length) {
            return [];
        }
        const keys = queueNames.map(name => `${WORKER_QUEUE_CONFIG_PREFIX}${name}`);
        const results = await this.redis.mget(keys);
        return results
            .filter(res => res !== null)
            .map(res => JSON.parse(res!) as WorkerQueueConfig);
    }

    async deleteWorkerQueueConfig(queueName: string): Promise<void> {
        const key = `${WORKER_QUEUE_CONFIG_PREFIX}${queueName}`;
        const result = await this.redis.multi()
            .del(key)
            .srem(ALL_WORKER_QUEUE_CONFIGS_KEY, queueName)
            .exec();

        if (result && result[0] && result[0][1] === 1) {
            console.log(`[ConfigService] Deleted WorkerQueueConfig for queue: ${queueName}`);
        } else {
            console.log(`[ConfigService] WorkerQueueConfig for queue: ${queueName} not found for deletion.`);
        }
    }
} 