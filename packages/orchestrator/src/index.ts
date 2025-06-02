import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import axios from 'axios';
import express from 'express';
import {
    Semaphore,
    BotTask,
    botExecutionCounter,
    botExecutionDuration,
    semaphoreUsageGauge,
    semaphoreWaitingGauge,
    getMetrics,
    serviceHealthGauge,
    queueSizeGauge
} from '@bot-core/common';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const WEBHOOK_MANAGER_URL = process.env.WEBHOOK_MANAGER_URL || 'http://webhook-manager:4000';

// Configurar Redis
const redis = new Redis({
    host: REDIS_HOST,
    port: 6379,
    maxRetriesPerRequest: null
});

// Configurar colas
const botQueue = new Queue('bot-tasks', { connection: redis });
const workerQueues = new Map([
    ['python', new Queue('bot-python-tasks', { connection: redis })],
    ['node', new Queue('bot-node-tasks', { connection: redis })],
    ['java', new Queue('bot-java-tasks', { connection: redis })]
]);

// Configurar semáforos por tipo de bot
const semaphoreConfigs = new Map([
    ['python', { max: parseInt(process.env.MAX_PYTHON_BOTS || '5'), timeout: 30000 }],
    ['node', { max: parseInt(process.env.MAX_NODE_BOTS || '10'), timeout: 30000 }],
    ['java', { max: parseInt(process.env.MAX_JAVA_BOTS || '3'), timeout: 30000 }]
]);

const semaphores = new Map<string, Semaphore>();

// Inicializar semáforos
for (const [botType, config] of semaphoreConfigs) {
    semaphores.set(
        botType,
        new Semaphore(redis, `semaphore:${botType}`, config.max, config.timeout)
    );
}

// Función para actualizar métricas de semáforos
async function updateSemaphoreMetrics() {
    for (const [botType, semaphore] of semaphores) {
        try {
            const currentCount = await semaphore.getCurrentCount();
            const availableCount = await semaphore.getAvailableCount();

            semaphoreUsageGauge.set({ semaphore_name: botType }, currentCount);
            semaphoreWaitingGauge.set({ semaphore_name: botType }, Math.max(0, semaphoreConfigs.get(botType)!.max - availableCount));
        } catch (error) {
            console.error(`Error updating metrics for semaphore ${botType}:`, error);
        }
    }
}

// Actualizar métricas cada 30 segundos
setInterval(updateSemaphoreMetrics, 30000);

// Worker principal para procesamiento de tareas
const mainWorker = new Worker('bot-tasks', async (job) => {
    const startTime = Date.now();
    let semaphoreIdentifier: string | null = null;

    try {
        const { botType, payload, webhookUrl, priority } = job.data as BotTask;

        console.log(`🤖 Processing ${botType} bot task: ${job.id}`);

        // Obtener semáforo correspondiente
        const semaphore = semaphores.get(botType);
        if (!semaphore) {
            throw new Error(`No semaphore configured for bot type: ${botType}`);
        }

        // Intentar adquirir semáforo
        console.log(`🔒 Acquiring semaphore for ${botType} bot...`);
        job.updateProgress(10);

        semaphoreIdentifier = await semaphore.acquire();
        console.log(`✅ Semaphore acquired for ${botType} bot: ${semaphoreIdentifier}`);

        job.updateProgress(20);

        // Delegar a worker específico
        const workerQueue = workerQueues.get(botType);
        if (!workerQueue) {
            throw new Error(`No worker queue found for bot type: ${botType}`);
        }

        console.log(`📤 Delegating to ${botType} worker queue...`);
        job.updateProgress(30);

        // Crear job en cola específica
        const workerJob = await workerQueue.add(`${botType}-execution`, {
            originalJobId: job.id,
            botType,
            payload,
            webhookUrl,
            priority,
            semaphoreIdentifier
        }, {
            priority,
            removeOnComplete: { count: 50 },
            removeOnFail: { count: 20 },
            attempts: 2,
            backoff: {
                type: 'exponential',
                delay: 1000
            }
        });

        job.updateProgress(50);

        // Simular tiempo de procesamiento y monitoreo del worker job
        let workerJobCompleted = false;
        let attempts = 0;
        const maxAttempts = 300; // 5 minutos máximo (300 * 1 segundo)

        while (!workerJobCompleted && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;

            try {
                const workerJobStatus = await workerJob.getState();

                if (workerJobStatus === 'completed') {
                    workerJobCompleted = true;
                    console.log(`✅ Worker job completed for ${botType} bot: ${workerJob.id}`);
                } else if (workerJobStatus === 'failed') {
                    const reason = workerJob.failedReason || 'Unknown error';
                    throw new Error(`Worker job failed: ${reason}`);
                }

                // Actualizar progreso
                const progress = Math.min(90, 50 + (attempts / maxAttempts) * 40);
                job.updateProgress(progress);

            } catch (error) {
                console.error(`Error checking worker job status:`, error);
            }
        }

        if (!workerJobCompleted) {
            throw new Error(`Worker job timed out after ${maxAttempts} seconds`);
        }

        job.updateProgress(100);

        // Registrar métricas
        const executionTime = (Date.now() - startTime) / 1000;
        botExecutionDuration.observe({ bot_type: botType }, executionTime);
        botExecutionCounter.inc({ bot_type: botType, status: 'completed' });

        console.log(`🎉 Bot task completed successfully in ${executionTime}s`);

        return {
            success: true,
            executionTime,
            workerJobId: workerJob.id,
            botType
        };

    } catch (error) {
        const executionTime = (Date.now() - startTime) / 1000;
        const botType = job.data?.botType || 'unknown';

        console.error(`❌ Bot task failed:`, error);

        // Registrar métricas de fallo
        botExecutionCounter.inc({ bot_type: botType, status: 'failed' });
        botExecutionDuration.observe({ bot_type: botType }, executionTime);

        throw error;

    } finally {
        // Liberar semáforo
        if (semaphoreIdentifier && job.data?.botType) {
            const semaphore = semaphores.get(job.data.botType);
            if (semaphore) {
                try {
                    await semaphore.release(semaphoreIdentifier);
                    console.log(`🔓 Semaphore released for ${job.data.botType}: ${semaphoreIdentifier}`);
                } catch (error) {
                    console.error(`Error releasing semaphore:`, error);
                }
            }
        }
    }
}, {
    connection: redis,
    concurrency: 20, // Procesar hasta 20 tareas simultáneamente
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 }
});

// Monitoreo de eventos del worker
mainWorker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
});

mainWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
});

mainWorker.on('stalled', (jobId) => {
    console.warn(`⚠️  Job ${jobId} stalled`);
});

// Función para limpiar trabajos antiguos
async function cleanupOldJobs() {
    try {
        console.log('🧹 Cleaning up old jobs...');

        // Limpiar trabajos completados y fallidos antiguos
        await botQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'); // 24 horas
        await botQueue.clean(7 * 24 * 60 * 60 * 1000, 100, 'failed'); // 7 días

        // Limpiar colas de workers
        for (const [botType, queue] of workerQueues) {
            await queue.clean(24 * 60 * 60 * 1000, 100, 'completed');
            await queue.clean(7 * 24 * 60 * 60 * 1000, 100, 'failed');
        }

        console.log('✅ Job cleanup completed');
    } catch (error) {
        console.error('❌ Error during job cleanup:', error);
    }
}

// Ejecutar limpieza cada hora
setInterval(cleanupOldJobs, 60 * 60 * 1000);

// Función para mostrar estadísticas
async function logStats() {
    try {
        const waiting = await botQueue.getWaiting();
        const active = await botQueue.getActive();

        console.log(`📊 Queue Stats - Waiting: ${waiting.length}, Active: ${active.length}`);

        // Estadísticas de semáforos
        for (const [botType, semaphore] of semaphores) {
            const current = await semaphore.getCurrentCount();
            const available = await semaphore.getAvailableCount();
            console.log(`🔒 Semaphore ${botType}: ${current}/${semaphoreConfigs.get(botType)!.max} used, ${available} available`);
        }
    } catch (error) {
        console.error('Error getting stats:', error);
    }
}

// Mostrar estadísticas cada 5 minutos
setInterval(logStats, 5 * 60 * 1000);

// Graceful shutdown
async function shutdown() {
    console.log('🛑 Shutting down Orchestrator...');

    try {
        await mainWorker.close();
        await botQueue.close();

        for (const [, queue] of workerQueues) {
            await queue.close();
        }

        await redis.quit();
        console.log('✅ Orchestrator shutdown completed');
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
    }

    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Configurar servidor HTTP para métricas
const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 3002;

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'orchestrator',
        semaphores: Object.fromEntries(semaphoreConfigs),
        queues: ['bot-tasks', 'bot-python-tasks', 'bot-node-tasks', 'bot-java-tasks']
    });
});

// Métricas de Prometheus
app.get('/metrics', async (req: express.Request, res: express.Response) => {
    try {
        // Actualizar métricas de colas antes de servir
        await updateQueueMetrics();
        await updateSemaphoreMetrics();

        const metrics = await getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error) {
        console.error('Error getting metrics:', error);
        res.status(500).json({ error: 'Failed to get metrics' });
    }
});

// Función para actualizar métricas de colas
async function updateQueueMetrics() {
    try {
        // Métricas de cola principal
        const [waiting, active, completed, failed] = await Promise.all([
            botQueue.getWaiting(),
            botQueue.getActive(),
            botQueue.getCompleted(),
            botQueue.getFailed()
        ]);

        queueSizeGauge.set({ queue_name: 'bot-tasks', state: 'waiting' }, waiting.length);
        queueSizeGauge.set({ queue_name: 'bot-tasks', state: 'active' }, active.length);
        queueSizeGauge.set({ queue_name: 'bot-tasks', state: 'completed' }, completed.length);
        queueSizeGauge.set({ queue_name: 'bot-tasks', state: 'failed' }, failed.length);

        // Métricas de colas de workers
        for (const [botType, queue] of workerQueues) {
            const [w, a, c, f] = await Promise.all([
                queue.getWaiting(),
                queue.getActive(),
                queue.getCompleted(),
                queue.getFailed()
            ]);

            queueSizeGauge.set({ queue_name: `bot-${botType}-tasks`, state: 'waiting' }, w.length);
            queueSizeGauge.set({ queue_name: `bot-${botType}-tasks`, state: 'active' }, a.length);
            queueSizeGauge.set({ queue_name: `bot-${botType}-tasks`, state: 'completed' }, c.length);
            queueSizeGauge.set({ queue_name: `bot-${botType}-tasks`, state: 'failed' }, f.length);
        }
    } catch (error) {
        console.error('Error updating queue metrics:', error);
    }
}

// Iniciar servidor HTTP
app.listen(PORT, () => {
    console.log(`📊 Orchestrator metrics server running on port ${PORT}`);
    serviceHealthGauge.set({ service: 'orchestrator', version: '1.0.0' }, 1);
});

// Update metrics every 30 seconds
setInterval(updateQueueMetrics, 30 * 1000);

console.log('🚀 Orchestrator started successfully');
console.log(`📍 Redis: ${REDIS_HOST}:6379`);
console.log(`🔗 Webhook Manager: ${WEBHOOK_MANAGER_URL}`);
console.log('🎯 Ready to process bot tasks...');

// Ejecutar estadísticas iniciales
logStats();
updateQueueMetrics(); 