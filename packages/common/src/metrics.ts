import { register, Counter, Histogram, Gauge } from 'prom-client';

// Habilitar métricas por defecto del sistema
import { collectDefaultMetrics } from 'prom-client';
collectDefaultMetrics();

// Métricas de ejecución de bots
export const botExecutionCounter = new Counter({
    name: 'bot_executions_total',
    help: 'Total number of bot executions',
    labelNames: ['bot_type', 'status', 'service']
});

export const botExecutionDuration = new Histogram({
    name: 'bot_execution_duration_seconds',
    help: 'Duration of bot executions in seconds',
    labelNames: ['bot_type', 'service'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
});

// Métricas de webhooks
export const webhookDeliveryCounter = new Counter({
    name: 'webhook_deliveries_total',
    help: 'Total number of webhook deliveries',
    labelNames: ['status', 'http_code']
});

export const webhookDeliveryDuration = new Histogram({
    name: 'webhook_delivery_duration_seconds',
    help: 'Duration of webhook deliveries in seconds',
    labelNames: ['status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

// Métricas de colas
export const queueSizeGauge = new Gauge({
    name: 'queue_size',
    help: 'Current size of queues',
    labelNames: ['queue_name', 'state']
});

export const queueJobsProcessedCounter = new Counter({
    name: 'queue_jobs_processed_total',
    help: 'Total number of jobs processed by queue',
    labelNames: ['queue_name', 'status']
});

// Métricas de semáforos
export const semaphoreUsageGauge = new Gauge({
    name: 'semaphore_usage',
    help: 'Current semaphore usage',
    labelNames: ['semaphore_name']
});

export const semaphoreWaitingGauge = new Gauge({
    name: 'semaphore_waiting',
    help: 'Number of tasks waiting for semaphore',
    labelNames: ['semaphore_name']
});

// Métricas de sistema
export const serviceHealthGauge = new Gauge({
    name: 'service_health',
    help: 'Service health status (1 = healthy, 0 = unhealthy)',
    labelNames: ['service', 'version']
});

export const activeConnectionsGauge = new Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
    labelNames: ['service', 'type']
});

// Métricas de Redis
export const redisConnectionsGauge = new Gauge({
    name: 'redis_connections',
    help: 'Number of Redis connections',
    labelNames: ['service']
});

export const redisCommandsCounter = new Counter({
    name: 'redis_commands_total',
    help: 'Total Redis commands executed',
    labelNames: ['service', 'command']
});

// Función para obtener todas las métricas
export const getMetrics = () => register.metrics();

// Función para resetear métricas (útil para testing)
export const resetMetrics = () => register.clear(); 