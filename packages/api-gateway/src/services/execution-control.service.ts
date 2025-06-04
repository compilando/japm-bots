import { Redis } from 'ioredis';
import {
    BotGroup,
    BotTypeConfig,
    ExecutionRule,
    PercentageBasedRuleConfig,
    TimeBasedRuleConfig,
    ParameterBasedRuleConfig,
    ABTestRuleConfig,
    ParameterCondition,
    BotExecutionRequest
} from '@bot-core/common';
import { ConfigService } from './config.service';

// --- Constantes para Redis Keys ---
const SEMAPHORE_PREFIX = 'semaphore:';
const CONCURRENCY_COUNTER_PREFIX = 'semaphore:count:'; // Actual count for a semaphore
const CADENCE_TIMESTAMP_PREFIX = 'cadence:ts:';
const CADENCE_COUNTER_PREFIX = 'cadence:count:'; // For maxPerInterval
const ROUND_ROBIN_INDEX_PREFIX = 'rule:rr_idx:';
const PERCENTAGE_DIST_STATE_PREFIX = 'rule:pct_state:'; // Para guardar contadores por botType en un grupo de porcentaje

// --- Definiciones de Scripts LUA (como strings) ---
// Estos deberían cargarse al inicio de la aplicación usando SCRIPT LOAD y luego llamarse con EVALSHA

const LUA_ACQUIRE_SEMAPHORE = `
  -- KEYS[1]: semaphore_count_key (e.g., semaphore:count:my-bot-type)
  -- ARGV[1]: limit
  local current = redis.call('GET', KEYS[1])
  if not current then
    current = 0
  else
    current = tonumber(current)
  end
  if current < tonumber(ARGV[1]) then
    redis.call('INCR', KEYS[1])
    return 1 -- Acquired
  else
    return 0 -- Limit reached or exceeded
  end
`;

const LUA_RELEASE_SEMAPHORE = `
  -- KEYS[1]: semaphore_count_key
  local current = redis.call('GET', KEYS[1])
  if current and tonumber(current) > 0 then
    redis.call('DECR', KEYS[1])
    return 1 -- Released
  elseif current and tonumber(current) <= 0 then
    -- Safety: reset to 0 if it somehow went negative, though DECR handles this by just going more negative.
    -- Or log an anomaly. For now, just return 0 indicating it was already at or below zero.
    redis.call('SET', KEYS[1], '0')
    return 0 -- Was already at 0 or less
  else 
    -- Key doesn't exist, effectively 0.
    redis.call('SET', KEYS[1], '0')
    return 0 -- Key didn't exist
  end
`;

const LUA_CHECK_SET_CADENCE = `
  -- KEYS[1]: timestamp_key (e.g., cadence:ts:my-bot)
  -- KEYS[2]: counter_key (e.g., cadence:count:my-bot) -- Only if ARGV[3] (maxPerInterval) is provided
  -- ARGV[1]: current_time_ms
  -- ARGV[2]: interval_seconds
  -- ARGV[3]: max_per_interval (optional, send as string '0' if not used)
  -- ARGV[4]: bot_type_for_counter (optional, only if ARGV[3] is > 0, used to reset counter for *this specific bot* if interval passed)

  local last_execution_ts = redis.call('GET', KEYS[1])
  local interval_ms = tonumber(ARGV[2]) * 1000
  local max_per_interval = tonumber(ARGV[3])
  local current_time = tonumber(ARGV[1])

  local time_passed_since_last = false
  if last_execution_ts then
    if (current_time - tonumber(last_execution_ts)) >= interval_ms then
      time_passed_since_last = true
    end
  else
    time_passed_since_last = true -- No previous execution, so interval is met
  end

  if max_per_interval > 0 then
    if time_passed_since_last then
      -- Interval has passed, reset counter for this specific botType to 1 and set its timestamp
      redis.call('SET', KEYS[1], current_time)
      redis.call('HSET', KEYS[2], ARGV[4], 1) -- Store count in a hash for the group/botType
      return 1 -- Allowed
    else
      -- Interval has NOT passed, check current count for this botType
      local current_count_for_bot = redis.call('HGET', KEYS[2], ARGV[4])
      if not current_count_for_bot then current_count_for_bot = 0 end
      current_count_for_bot = tonumber(current_count_for_bot)

      if current_count_for_bot < max_per_interval then
        redis.call('HINCRBY', KEYS[2], ARGV[4], 1)
        -- Do NOT update the global timestamp KEYS[1] here, only the counter for this botType
        return 1 -- Allowed
      else
        return 0 -- Rejected, max_per_interval for this botType within global interval met
      end
    end
  else
    -- Simple cadence (no maxPerInterval)
    if time_passed_since_last then
      redis.call('SET', KEYS[1], current_time)
      return 1 -- Allowed
    else
      return 0 -- Rejected, still within cadence period
    end
  end
`;

interface LuaScriptSha {
    acquireSemaphore?: string;
    releaseSemaphore?: string;
    checkAndSetCadence?: string;
}

export class ExecutionControlService {
    private luaSha: LuaScriptSha = {};

    constructor(private redis: Redis, private configService: ConfigService) {
        this.loadLuaScripts();
    }

    private async loadLuaScripts(): Promise<void> {
        try {
            // ioredis types for script LOAD might expect a more specific type or arguments.
            // For simplicity, casting to `any` if type errors occur here, but ideally use correct types.
            this.luaSha.acquireSemaphore = await this.redis.script('LOAD' as any, LUA_ACQUIRE_SEMAPHORE as any) as string;
            this.luaSha.releaseSemaphore = await this.redis.script('LOAD' as any, LUA_RELEASE_SEMAPHORE as any) as string;
            this.luaSha.checkAndSetCadence = await this.redis.script('LOAD' as any, LUA_CHECK_SET_CADENCE as any) as string;
            console.log('[ExecutionControlService] LUA scripts loaded successfully.');
        } catch (error) {
            console.error('[ExecutionControlService] CRITICAL: Failed to load LUA scripts:', error);
            // Aplicación podría no funcionar correctamente sin los scripts. Considerar manejo de error más robusto.
        }
    }

    async selectBotFromGroup(groupId: string, requestParams?: Record<string, any>): Promise<string | null> {
        const group = await this.configService.getBotGroup(groupId);
        if (!group || !group.botTypes || group.botTypes.length === 0) {
            console.warn(`[ExecutionControlService] Group ${groupId} not found or has no botTypes.`);
            return null;
        }

        const rule = group.executionRule;
        let selectedBotType: string | undefined;

        // Ensure all bot types in the group exist and are configured
        const availableBotTypesInGroup = [];
        for (const bt of group.botTypes) {
            const config = await this.configService.getBotTypeConfig(bt);
            if (config) availableBotTypesInGroup.push(bt);
            else console.warn(`[ExecutionControlService] BotType ${bt} in group ${groupId} is not configured. Skipping.`);
        }

        if (availableBotTypesInGroup.length === 0) {
            console.warn(`[ExecutionControlService] No configured and available botTypes in group ${groupId}.`);
            return null;
        }

        switch (rule.type) {
            case 'ROUND_ROBIN':
                selectedBotType = await this.handleRoundRobin(group.groupId, availableBotTypesInGroup);
                break;
            case 'PERCENTAGE_BASED':
                selectedBotType = await this.handlePercentageBased(group.groupId, rule.config as PercentageBasedRuleConfig, availableBotTypesInGroup, requestParams);
                break;
            case 'TIME_BASED':
                selectedBotType = this.handleTimeBased(rule.config as TimeBasedRuleConfig, availableBotTypesInGroup);
                break;
            case 'PARAMETER_BASED':
                selectedBotType = this.handleParameterBased(rule.config as ParameterBasedRuleConfig, availableBotTypesInGroup, requestParams);
                break;
            case 'A_B_TEST':
                selectedBotType = await this.handleABTest(group.groupId, rule.config as ABTestRuleConfig, availableBotTypesInGroup);
                break;
            default:
                console.warn(`[ExecutionControlService] Unknown rule type: ${(rule as any).type} for group ${groupId}. Falling back to first bot.`);
                selectedBotType = availableBotTypesInGroup[0];
        }
        return selectedBotType || null;
    }

    private async handleRoundRobin(groupId: string, botTypes: string[]): Promise<string | undefined> {
        if (!botTypes.length) return undefined;
        const key = `${ROUND_ROBIN_INDEX_PREFIX}${groupId}`;
        const currentIndex = await this.redis.incr(key);
        return botTypes[(currentIndex - 1) % botTypes.length];
    }

    private async handlePercentageBased(groupId: string, config: PercentageBasedRuleConfig, availableBotTypes: string[], requestParams?: Record<string, any>): Promise<string | undefined> {
        const validDistributions = config.distribution.filter(d => availableBotTypes.includes(d.botType) && d.percentage > 0);
        if (!validDistributions.length) return availableBotTypes.length > 0 ? availableBotTypes[0] : undefined; // Fallback

        let totalPercentage = validDistributions.reduce((sum, dist) => sum + dist.percentage, 0);
        if (totalPercentage === 0) return availableBotTypes.length > 0 ? availableBotTypes[0] : undefined; // Avoid division by zero if all percentages are 0

        let randomPick = Math.random() * totalPercentage;

        for (const dist of validDistributions) {
            if (randomPick < dist.percentage) {
                return dist.botType;
            }
            randomPick -= dist.percentage;
        }
        return validDistributions[validDistributions.length - 1].botType; // Fallback for potential rounding issues or if randomPick equals totalPercentage
    }

    private handleTimeBased(config: TimeBasedRuleConfig, availableBotTypes: string[]): string | undefined {
        const now = new Date();
        const currentTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

        for (const slot of config.slots) {
            if (availableBotTypes.includes(slot.botType) && currentTime >= slot.startTime && currentTime <= slot.endTime) {
                return slot.botType;
            }
        }
        if (config.defaultBotType && availableBotTypes.includes(config.defaultBotType)) {
            return config.defaultBotType;
        }
        return availableBotTypes.length > 0 ? availableBotTypes[0] : undefined; // Fallback
    }

    private handleParameterBased(config: ParameterBasedRuleConfig, availableBotTypes: string[], requestParams?: Record<string, any>): string | undefined {
        if (!requestParams) {
            if (config.defaultBotType && availableBotTypes.includes(config.defaultBotType)) return config.defaultBotType;
            return availableBotTypes.length > 0 ? availableBotTypes[0] : undefined; // Fallback if no params provided and no default
        }

        for (const branch of config.branches) {
            if (!availableBotTypes.includes(branch.botType)) continue; // Skip if bot type in branch is not available

            let conditionsMet = true;
            for (const cond of branch.conditions) {
                const paramValue = requestParams[cond.paramName];
                if (!this.evaluateCondition(paramValue, cond)) {
                    conditionsMet = false;
                    break;
                }
            }
            if (conditionsMet) {
                return branch.botType;
            }
        }
        if (config.defaultBotType && availableBotTypes.includes(config.defaultBotType)) {
            return config.defaultBotType;
        }
        return availableBotTypes.length > 0 ? availableBotTypes[0] : undefined; // Fallback
    }

    private evaluateCondition(paramValue: any, condition: ParameterCondition): boolean {
        if (paramValue === undefined) {
            if (condition.operator === 'EQUALS' && (condition.value === undefined || condition.value === null)) return true;
            if (condition.operator === 'NOT_EQUALS' && !(condition.value === undefined || condition.value === null)) return true;
            // For other operators, if param is undefined, condition usually fails unless specific handling for undefined is intended by rule.
            return false;
        }
        switch (condition.operator) {
            case 'EQUALS': return paramValue == condition.value; // Using == for type coercion flexibility as defined by user
            case 'NOT_EQUALS': return paramValue != condition.value;
            case 'GREATER_THAN': return typeof paramValue === 'number' && typeof condition.value === 'number' && paramValue > condition.value;
            case 'LESS_THAN': return typeof paramValue === 'number' && typeof condition.value === 'number' && paramValue < condition.value;
            case 'CONTAINS': return typeof paramValue === 'string' && typeof condition.value === 'string' && paramValue.includes(condition.value);
            case 'REGEX_MATCH':
                if (typeof paramValue === 'string' && typeof condition.value === 'string') {
                    try {
                        return new RegExp(condition.value).test(paramValue);
                    } catch (e) {
                        console.warn(`[ExecutionControlService] Invalid regex for condition: ${condition.value}`, e);
                        return false;
                    }
                }
                return false;
            default:
                const exhaustiveCheck: never = condition.operator;
                console.warn(`[ExecutionControlService] Unknown operator: ${exhaustiveCheck}`);
                return false;
        }
    }

    private async handleABTest(groupId: string, config: ABTestRuleConfig, availableBotTypes: string[]): Promise<string | undefined> {
        const validVariants = config.variants.filter(v => availableBotTypes.includes(v.botType) && v.weight > 0);
        if (!validVariants.length) return availableBotTypes.length > 0 ? availableBotTypes[0] : undefined; // Fallback

        let totalWeight = validVariants.reduce((sum, v) => sum + v.weight, 0);
        if (totalWeight === 0) return availableBotTypes.length > 0 ? availableBotTypes[0] : undefined; // Avoid division by zero

        let randomPick = Math.random() * totalWeight;

        for (const variant of validVariants) {
            if (randomPick < variant.weight) {
                return variant.botType;
            }
            randomPick -= variant.weight;
        }
        return validVariants[validVariants.length - 1].botType; // Fallback for potential rounding issues
    }

    // --- Concurrency Methods ---
    async acquireConcurrencySlot(botType: string, limit: number): Promise<boolean> {
        if (!this.luaSha.acquireSemaphore) {
            console.error('[ExecutionControlService] Acquire Semaphore LUA script not loaded. Denying acquisition.');
            return false;
        }
        try {
            const key = `${CONCURRENCY_COUNTER_PREFIX}${botType}`;
            const result = await this.redis.evalsha(this.luaSha.acquireSemaphore, 1, key, limit.toString());
            return result === 1;
        } catch (error: any) { // Catching as any to access error.message
            console.error(`[ExecutionControlService] Error acquiring semaphore for ${botType} via LUA:`, error);
            if (error.message && error.message.includes('NOSCRIPT')) {
                console.warn('[ExecutionControlService] NOSCRIPT error for acquireSemaphore, attempting to reload and EVAL.');
                try {
                    this.luaSha.acquireSemaphore = await this.redis.script('LOAD' as any, LUA_ACQUIRE_SEMAPHORE as any) as string;
                    const key = `${CONCURRENCY_COUNTER_PREFIX}${botType}`;
                    const result = await this.redis.eval(LUA_ACQUIRE_SEMAPHORE, 1, key, limit.toString());
                    return result === 1;
                } catch (evalError) {
                    console.error('[ExecutionControlService] Error on fallback EVAL for acquireSemaphore:', evalError);
                    return false; // Critical failure
                }
            }
            return false;
        }
    }

    async releaseConcurrencySlot(botType: string): Promise<void> {
        if (!this.luaSha.releaseSemaphore) {
            console.error('[ExecutionControlService] Release Semaphore LUA script not loaded. Cannot release.');
            return;
        }
        try {
            const key = `${CONCURRENCY_COUNTER_PREFIX}${botType}`;
            await this.redis.evalsha(this.luaSha.releaseSemaphore, 1, key);
        } catch (error: any) { // Catching as any
            console.error(`[ExecutionControlService] Error releasing semaphore for ${botType} via LUA:`, error);
            if (error.message && error.message.includes('NOSCRIPT')) {
                console.warn('[ExecutionControlService] NOSCRIPT error for releaseSemaphore, attempting to reload and EVAL.');
                try {
                    this.luaSha.releaseSemaphore = await this.redis.script('LOAD' as any, LUA_RELEASE_SEMAPHORE as any) as string;
                    const key = `${CONCURRENCY_COUNTER_PREFIX}${botType}`;
                    await this.redis.eval(LUA_RELEASE_SEMAPHORE, 1, key);
                } catch (evalError) {
                    console.error('[ExecutionControlService] Error on fallback EVAL for releaseSemaphore:', evalError);
                }
            }
        }
    }

    // --- Cadence Methods ---
    async checkAndSetCadence(botType: string, intervalSeconds: number, maxPerInterval: number = 0): Promise<boolean> {
        if (!this.luaSha.checkAndSetCadence) {
            console.error('[ExecutionControlService] Check/Set Cadence LUA script not loaded. Denying execution.');
            return false;
        }
        try {
            const timestampKey = `${CADENCE_TIMESTAMP_PREFIX}${botType}`;
            const counterKeyForHash = `${CADENCE_COUNTER_PREFIX}${botType}`;

            const result = await this.redis.evalsha(
                this.luaSha.checkAndSetCadence,
                2, // Number of KEYS
                timestampKey,
                counterKeyForHash,
                Date.now().toString(),
                intervalSeconds.toString(),
                maxPerInterval.toString(),
                botType // ARGV[4] for the LUA script (bot_type_for_counter)
            );
            return result === 1;
        } catch (error: any) { // Catching as any
            console.error(`[ExecutionControlService] Error checking/setting cadence for ${botType} via LUA:`, error);
            if (error.message && error.message.includes('NOSCRIPT')) {
                console.warn('[ExecutionControlService] NOSCRIPT error for checkAndSetCadence, attempting to reload and EVAL.');
                try {
                    this.luaSha.checkAndSetCadence = await this.redis.script('LOAD' as any, LUA_CHECK_SET_CADENCE as any) as string;
                    const timestampKey = `${CADENCE_TIMESTAMP_PREFIX}${botType}`;
                    const counterKeyForHash = `${CADENCE_COUNTER_PREFIX}${botType}`;
                    const result = await this.redis.eval(
                        LUA_CHECK_SET_CADENCE,
                        2,
                        timestampKey,
                        counterKeyForHash,
                        Date.now().toString(),
                        intervalSeconds.toString(),
                        maxPerInterval.toString(),
                        botType
                    );
                    return result === 1;
                } catch (evalError) {
                    console.error('[ExecutionControlService] Error on fallback EVAL for checkAndSetCadence:', evalError);
                    return false;
                }
            }
            return false;
        }
    }
} 