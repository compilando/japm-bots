import { register, Counter, Histogram, Gauge } from 'prom-client';

// Métricas de ejecución de bots
export const botExecutionCounter = new Counter({
    name: 'bot_executions_total',
    help: 'Total number of bot executions',
    labelNames: ['bot_type', 'status']
});

export const botExecutionDuration = new Histogram({
    name: 'bot_execution_duration_seconds',
    help: 'Duration of bot executions in seconds',
    labelNames: ['bot_type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

// Métricas de webhooks
export const webhookDeliveryCounter = new Counter({
    name: 'webhook_deliveries_total',
    help: 'Total number of webhook deliveries',
    labelNames: ['status']
});

export const webhookDeliveryDuration = new Histogram({
    name: 'webhook_delivery_duration_seconds',
    help: 'Duration of webhook deliveries in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10]
});

// Métricas de colas
export const queueSizeGauge = new Gauge({
    name: 'queue_size',
    help: 'Current size of queues',
    labelNames: ['queue_name']
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

// Función para obtener todas las métricas
export const getMetrics = () => register.metrics();

// Función para resetear métricas (útil para testing)
export const resetMetrics = () => register.clear(); 