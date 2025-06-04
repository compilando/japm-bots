export interface BotTask {
    id: string; // Job ID from BullMQ, typically a UUID
    botType: string; // Identificador único del tipo de bot, e.g., "python-analyzer-v1"
    runtimeType: string; // e.g., "python_image_processor", "n8n_customer_sync"
    workerTargetQueue: string; // Nombre de la cola BullMQ del worker, ej: "python-workers", "n8n-workflows"
    payload: Record<string, any>;
    webhookUrl: string;
    priority?: number;
    correlationId?: string; // Para rastrear la solicitud a través de los sistemas
    executionGroupId?: string; // Si la tarea fue generada como parte de un grupo
    createdAt: Date;
    updatedAt: Date;
    retryAttempts?: number;    // From BotTypeConfig or request
    backoffDelay?: number;     // From BotTypeConfig or request
    // semaphoreIdentifier?: string; // Orchestrator adds this when sending to specific worker queue
}

export interface WebhookDelivery {
    jobId: string;
    result: any;
    webhookUrl: string;
    attempt: number;
    maxAttempts: number;
    createdAt: Date;
}

export interface BotResult {
    success: boolean;
    data?: any;
    error?: string;
    executionTime: number;
    botType: string;
}

export interface SemaphoreConfig {
    name: string;
    maxConcurrency: number;
    timeout: number;
}

export interface MetricsData {
    botExecutions: number;
    webhookDeliveries: number;
    queueSize: number;
    activeSemaphores: Record<string, number>;
}

// Bot System Specific Types from here

export interface BotConcurrencyConfig {
    limit: number;
}

export interface BotCadenceConfig {
    intervalSeconds: number;
    maxPerInterval?: number; // Optional: "no more than X executions per intervalSeconds"
}

export interface BotTypeConfig {
    botType: string; // Unique identifier, e.g., "data-scraper-alpha"
    description?: string;
    runtimeType: string; // Añadido: Describe el entorno/tipo de runtime
    workerTargetQueue: string; // Añadido: Nombre de la cola BullMQ para este tipo de bot
    concurrency?: BotConcurrencyConfig;
    cadence?: BotCadenceConfig;
    defaultPriority?: number; // Default BullMQ job priority
    retryAttempts?: number; // Default BullMQ job retry attempts
    // Potentially other metadata like version, owner, etc.
}

// --- Execution Rules for Bot Groups ---

export interface RuleBaseConfig {
    // Common fields for all rule configurations, if any in the future
}

export interface RoundRobinRuleConfig extends RuleBaseConfig {
    // No specific config needed; simply iterates through botTypes in the group
}

export interface PercentageBasedRuleConfig extends RuleBaseConfig {
    distribution: Array<{
        botType: string;
        percentage: number; // Integer 0-100
    }>;
}

export interface TimeBasedSlot {
    botType: string;
    startTime: string; // Format "HH:mm" (UTC)
    endTime: string;   // Format "HH:mm" (UTC)
}

export interface TimeBasedRuleConfig extends RuleBaseConfig {
    slots: TimeBasedSlot[];
    defaultBotType?: string; // Bot to use if current time doesn't match any slot
}

export interface ParameterCondition {
    paramName: string; // Name of the parameter in the execution request
    operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS' | 'REGEX_MATCH';
    value: any; // Value to compare against
}

export interface ParameterBasedBranch {
    botType: string;
    conditions: ParameterCondition[]; // Conditions are ANDed
}

export interface ParameterBasedRuleConfig extends RuleBaseConfig {
    branches: ParameterBasedBranch[]; // Evaluated in order; first match is chosen
    defaultBotType?: string; // Bot to use if no branch conditions are met
}

export interface ABTestVariant {
    botType: string;
    weight: number; // Relative weight for distribution
}

export interface ABTestRuleConfig extends RuleBaseConfig {
    variants: ABTestVariant[];
    // Could add trackingId or metricName for more advanced A/B testing analytics
}

export type ExecutionRuleConfigData =
    | RoundRobinRuleConfig
    | PercentageBasedRuleConfig
    | TimeBasedRuleConfig
    | ParameterBasedRuleConfig
    | ABTestRuleConfig;

export interface ExecutionRule {
    type: 'ROUND_ROBIN' | 'PERCENTAGE_BASED' | 'TIME_BASED' | 'PARAMETER_BASED' | 'A_B_TEST';
    config: ExecutionRuleConfigData;
}

export interface BotGroup {
    groupId: string; // Unique identifier, e.g., "data-processors"
    name: string;
    description?: string;
    botTypes: string[]; // List of botType identifiers belonging to this group
    executionRule: ExecutionRule;
}

// --- API Request/Response Types ---

export interface BotExecutionRequest {
    // Can target a specific botType or a groupId
    webhookUrl?: string;
    target: string; // Format: "botType:my-specific-bot" or "groupId:my-processing-group"
    params?: Record<string, any>; // Business parameters for 'PARAMETER_BASED' rules or for the bot itself
    correlationId?: string; // For end-to-end tracking
    priority?: number; // Override default priority for this specific execution
}

// You might want a BotExecutionResponse type as well
// export interface BotExecutionResponse {
//   jobId: string;
//   status: string; // e.g., 'enqueued', 'rejected_concurrency', 'rejected_cadence'
//   message: string;
//   estimatedPosition?: number; // If enqueued
//   botType?: string; // The actual botType that was enqueued (especially if from a group)
// }

// Example of a BotTask payload (this might already exist or be similar)
// Ensure this includes what the orchestrator and workers need.
// export interface BotTaskData {
//   botType: string;
//   language: 'python' | 'node' | 'java';
//   payload: any; // The actual data/parameters for the bot script
//   correlationId?: string;
//   // Potentially other job-related info like executionGroupId if it was part of a group
// }

/**
 * Configuration for a specific worker queue, managed via Admin UI.
 * This will be stored in Redis and read by the Orchestrator to configure semaphores.
 */
export interface WorkerQueueConfig {
    queueName: string;          // The exact name of the worker queue (e.g., "python-tasks", "n8n-workflows")
    maxConcurrency?: number;   // Max concurrent jobs for this queue (overrides orchestrator env/default)
    timeoutMs?: number;        // Semaphore acquisition timeout in milliseconds (overrides orchestrator env/default)
    description?: string;      // Optional description for the UI
} 