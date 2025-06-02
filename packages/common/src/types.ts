export interface BotTask {
    id: string;
    botType: 'python' | 'node' | 'java';
    payload: Record<string, any>;
    webhookUrl: string;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
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