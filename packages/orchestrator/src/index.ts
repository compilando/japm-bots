import { Worker, Queue, Job } from 'bullmq';
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
    queueSizeGauge,
    WorkerQueueConfig
} from '@bot-core/common';
import { v4 as uuidv4 } from 'uuid';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const WEBHOOK_MANAGER_URL = process.env.WEBHOOK_MANAGER_URL || 'http://webhook-manager:4000';

// API Gateway Configuration
const API_GATEWAY_SCHEMA = process.env.API_GATEWAY_SCHEMA || 'http';
const API_GATEWAY_HOSTNAME = process.env.API_GATEWAY_HOST || 'api-gateway'; // Default for service-to-service communication
const API_GATEWAY_PORT_ENV = process.env.API_GATEWAY_PORT || '3000';
const API_GATEWAY_BASE_PATH_ENV = process.env.API_GATEWAY_BASE_PATH || '';
const API_GATEWAY_SERVICE_URL_BASE = `${API_GATEWAY_SCHEMA}://${API_GATEWAY_HOSTNAME}:${API_GATEWAY_PORT_ENV}${API_GATEWAY_BASE_PATH_ENV}`;

// Prefijo para leer WorkerQueueConfig de Redis (debe coincidir con api-gateway)
const WORKER_QUEUE_CONFIG_REDIS_PREFIX = 'config:wq:';

// Configurar Redis
const redisConnection = new Redis({
    host: REDIS_HOST,
    port: 6379,
    maxRetriesPerRequest: null
});

// Cola principal de tareas de bot
const botQueue = new Queue('bot-tasks', { connection: redisConnection });

// Caché para instancias de colas de worker específicas
const workerQueuesCache = new Map<string, Queue>();

// Función para obtener o crear una instancia de cola de worker
function getWorkerQueue(queueName: string, connection: Redis): Queue {
    if (workerQueuesCache.has(queueName)) {
        return workerQueuesCache.get(queueName)!;
    }
    console.log(`[Orchestrator] Creating new BullMQ worker queue instance for: ${queueName}`);
    const newQueue = new Queue(queueName, { connection }); // Usar el connection pasado
    workerQueuesCache.set(queueName, newQueue);
    return newQueue;
}

// Configuración de semáforos por workerTargetQueue
const semaphoreConfigs = new Map<string, { max: number; timeout: number }>();

// Primero definir DEFAULT_SEMAPHORE_CONFIG para que esté disponible si se referencian en el log o en el parseo de specific configs
const DEFAULT_SEMAPHORE_CONFIG = {
    max: parseInt(process.env.DEFAULT_WORKER_SEMAPHORE_MAX || '3', 10),
    timeout: parseInt(process.env.DEFAULT_WORKER_SEMAPHORE_TIMEOUT || '30000', 10)
};
console.log('[Orchestrator] Default semaphore config: max=' + DEFAULT_SEMAPHORE_CONFIG.max + ', timeout=' + DEFAULT_SEMAPHORE_CONFIG.timeout + 'ms');

// Este Map (semaphoreConfigs) ahora sirve como caché para configuraciones leídas de ENV (fallback)
const envSemaphoreConfigs = new Map<string, { max: number; timeout: number }>();

console.log('[Orchestrator] Searching for specific semaphore configurations in environment variables (e.g., SEMAPHORE_MAX_my-queue-name=5, SEMAPHORE_TIMEOUT_my-queue-name=30000) as fallback...');
Object.keys(process.env).forEach(key => {
    if (key.startsWith('SEMAPHORE_MAX_')) {
        const queueNameSuffix = key.substring('SEMAPHORE_MAX_'.length);
        const queueName = queueNameSuffix.toLowerCase().replace(/_/g, '-');
        const maxVal = process.env[key];
        const max = parseInt(maxVal || '', 10);
        const timeoutKey = `SEMAPHORE_TIMEOUT_${queueNameSuffix}`;
        const timeoutVal = process.env[timeoutKey];
        const parsedTimeout = parseInt(timeoutVal || '', 10);
        const timeout = isNaN(parsedTimeout) ? DEFAULT_SEMAPHORE_CONFIG.timeout : parsedTimeout;

        if (queueName && !isNaN(max) && max > 0 && !isNaN(timeout) && timeout >= 0) {
            envSemaphoreConfigs.set(queueName, { max, timeout });
            console.log('[Orchestrator] Loaded ENV semaphore config for queue \'' + queueName + '\': max=' + max + ', timeout=' + timeout + 'ms');
        } else {
            if (maxVal) {
                console.warn('[Orchestrator] Invalid or incomplete ENV semaphore config for key ' + key + '.');
            }
        }
    }
});

const semaphores = new Map<string, Semaphore>();

async function getSemaphoreForQueue(queueName: string, connection: Redis): Promise<Semaphore> {
    if (semaphores.has(queueName)) {
        return semaphores.get(queueName)!;
    }

    let finalMax = DEFAULT_SEMAPHORE_CONFIG.max;
    let finalTimeout = DEFAULT_SEMAPHORE_CONFIG.timeout;
    let configSource = 'Default Global Config';

    // 1. Intentar cargar desde Redis
    const redisConfigKey = `${WORKER_QUEUE_CONFIG_REDIS_PREFIX}${queueName}`;
    try {
        const redisConfigStr = await connection.get(redisConfigKey);
        if (redisConfigStr) {
            const redisConfig = JSON.parse(redisConfigStr) as WorkerQueueConfig;
            if (redisConfig.maxConcurrency !== undefined && redisConfig.maxConcurrency >= 0) {
                finalMax = redisConfig.maxConcurrency;
                configSource = 'Redis Config';
            } else {
                // Si maxConcurrency no está en Redis, pero la config existe, usamos el default para max y seguimos buscando timeout
                console.log(`[Orchestrator] maxConcurrency not set or invalid in Redis for ${queueName}, using default ${finalMax} for max.`);
            }
            // El timeout de Redis tiene precedencia si está definido y es válido, incluso si maxConcurrency no lo estaba.
            if (redisConfig.timeoutMs !== undefined && redisConfig.timeoutMs >= 0) {
                finalTimeout = redisConfig.timeoutMs;
                // Si finalMax no vino de Redis, pero finalTimeout sí, la fuente es mixta. Simplificamos a Redis si algo vino de allí.
                if (configSource !== 'Redis Config') configSource = 'Redis Config (timeout only)';
                else configSource = 'Redis Config (max & timeout)';
            } else if (configSource === 'Redis Config') {
                // max vino de Redis pero timeout no, o es inválido.
                console.log(`[Orchestrator] timeoutMs not set or invalid in Redis for ${queueName}, using default ${finalTimeout} for timeout.`);
            }
            console.log('[Orchestrator] Found config in Redis for queue \'' + queueName + '\'. Using max=' + finalMax + ', timeout=' + finalTimeout + 'ms. Source: ' + configSource);
        } else {
            console.log('[Orchestrator] No specific config in Redis for queue \'' + queueName + '\'. Falling back...');
        }
    } catch (error: any) {
        console.error('[Orchestrator] Error reading WorkerQueueConfig from Redis for \'' + queueName + '\': ' + error.message + '. Falling back...');
        // En caso de error de Redis, no sobreescribimos los defaults/ENV que ya podrían estar establecidos como prioritarios
    }

    // 2. Si no se encontró en Redis (o solo parcialmente), intentar cargar desde variables de entorno (envSemaphoreConfigs)
    // Solo si Redis no proporcionó una configuración completa (max)
    if (configSource !== 'Redis Config (max & timeout)' && configSource !== 'Redis Config') {
        const envConfig = envSemaphoreConfigs.get(queueName);
        if (envConfig) {
            finalMax = envConfig.max; // ENV max anula default si no hay Redis max
            finalTimeout = envConfig.timeout; // ENV timeout anula default/Redis(timeout only) si no hay Redis max
            configSource = 'Environment Variables';
            console.log('[Orchestrator] Using ENV config for queue \'' + queueName + '\': max=' + finalMax + ', timeout=' + finalTimeout + 'ms. Source: ' + configSource);
        }
    }

    console.log('[Orchestrator] Final Semaphore config for queue: \'' + queueName + '\' -> max=' + finalMax + ', timeout=' + finalTimeout + 'ms. Determined by: ' + configSource);

    // Poblar el mapa semaphoreConfigs con la configuración efectiva que se usará
    semaphoreConfigs.set(queueName, { max: finalMax, timeout: finalTimeout });

    const newSemaphore = new Semaphore(connection, 'semaphore:' + queueName, finalMax, finalTimeout);
    semaphores.set(queueName, newSemaphore);
    return newSemaphore;
}

async function updateSemaphoreMetrics() {
    for (const [queueName, semaphore] of semaphores) {
        try {
            const currentCount = await semaphore.getCurrentCount();
            const availableCount = await semaphore.getAvailableCount();

            // Obtener la configuración del semáforo desde el mapa 'semaphoreConfigs'
            const config = semaphoreConfigs.get(queueName) || DEFAULT_SEMAPHORE_CONFIG;

            semaphoreUsageGauge.set({ semaphore_name: queueName }, currentCount);
            semaphoreWaitingGauge.set({ semaphore_name: queueName }, Math.max(0, config.max - availableCount));
        } catch (error: any) {
            console.error('[Orchestrator] Error updating metrics for semaphore ' + queueName + ': ' + error.message);
        }
    }
}

const mainWorker = new Worker('bot-tasks', async (job) => {
    const startTime = Date.now();
    let semaphoreIdentifier: string | null = null;
    const taskData = job.data as BotTask;

    try {
        const { botType, payload, webhookUrl, priority, correlationId, executionGroupId, runtimeType, workerTargetQueue } = taskData;

        if (!workerTargetQueue) {
            console.error('[Orchestrator] Critical: workerTargetQueue missing for botType: ' + botType + ' Job: ' + job.id + ' CorrID: ' + correlationId);
            throw new Error('workerTargetQueue is missing for botType: ' + botType);
        }

        console.log('[Orchestrator] Processing botType: ' + botType + ' (runtime: ' + runtimeType + ', targetQueue: ' + workerTargetQueue + ') task: ' + job.id + ' CorrID: ' + correlationId);

        const semaphore = await getSemaphoreForQueue(workerTargetQueue, redisConnection);

        console.log('[Orchestrator] Acquiring semaphore for targetQueue: ' + workerTargetQueue + ' (botType: ' + botType + ') Job: ' + job.id);
        job.updateProgress(10);
        semaphoreIdentifier = await semaphore.acquire();
        console.log('[Orchestrator] Semaphore acquired for targetQueue: ' + workerTargetQueue + ' ID: ' + semaphoreIdentifier + ' Job: ' + job.id);
        job.updateProgress(20);

        const workerQueueInstance = getWorkerQueue(workerTargetQueue, redisConnection);
        console.log('[Orchestrator] Delegating to queue: ' + workerTargetQueue + ' (botType: ' + botType + ') Job: ' + job.id);
        job.updateProgress(30);

        const workerJobPayload = { originalJobId: job.id, botType, runtimeType, workerTargetQueue, payload, webhookUrl, priority, semaphoreIdentifier, correlationId, executionGroupId, retryAttempts: taskData.retryAttempts, backoffDelay: taskData.backoffDelay };
        const workerJob: Job = await workerQueueInstance.add(botType + '-' + runtimeType + '-execution', workerJobPayload, {
            priority, removeOnComplete: { count: 500, age: 24 * 3600 }, removeOnFail: { count: 200, age: 7 * 24 * 3600 },
            attempts: taskData.retryAttempts || 2, backoff: { type: 'exponential', delay: taskData.backoffDelay || 1000 },
            jobId: job.id + '-' + (correlationId || uuidv4()) + '-worker'
        });

        job.updateProgress(50);
        console.log('[Orchestrator] Waiting for worker job: ' + workerJob.id + ' (on queue ' + workerTargetQueue + ') MainJob: ' + job.id);

        let workerJobCompleted = false, workerJobFailed = false, workerFailureReason: string | null = null, attempts = 0;
        const maxAttempts = 300;
        while (!workerJobCompleted && !workerJobFailed && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
            try {
                const workerJobStatus = await workerJob.getState();
                if (workerJobStatus === 'completed') {
                    workerJobCompleted = true;
                    console.log('[Orchestrator] Worker job ' + workerJob.id + ' (on ' + workerTargetQueue + ') completed for botType ' + botType + '. MainJob: ' + job.id);
                } else if (workerJobStatus === 'failed') {
                    workerJobFailed = true; workerFailureReason = workerJob.failedReason || 'Unknown error';
                    console.error('[Orchestrator] Worker job ' + workerJob.id + ' (on ' + workerTargetQueue + ') failed for botType ' + botType + ': ' + workerFailureReason + '. MainJob: ' + job.id);
                }
                job.updateProgress(Math.min(90, 50 + (attempts / maxAttempts) * 40));
            } catch (error: any) {
                console.error('[Orchestrator] Error checking worker job ' + workerJob.id + ' status. MainJob: ' + job.id + ': ' + error.message);
            }
        }

        if (workerJobFailed) throw new Error('Worker job ' + workerJob.id + ' failed: ' + workerFailureReason);
        if (!workerJobCompleted) throw new Error('Worker job ' + workerJob.id + ' timed out');

        job.updateProgress(100);
        console.log('[Orchestrator] Worker job ' + workerJob.id + ' (on ' + workerTargetQueue + ') processed successfully. MainJob: ' + job.id);
        await releaseApiGatewayConcurrencySlot(botType, job.id, correlationId);

        const executionTime = (Date.now() - startTime) / 1000;
        botExecutionDuration.observe({ bot_type: botType, service: 'orchestrator' }, executionTime);
        botExecutionCounter.inc({ bot_type: botType, status: 'completed', service: 'orchestrator' });
        console.log('[Orchestrator] Bot task ' + job.id + ' for botType ' + botType + ' (targetQueue: ' + workerTargetQueue + ') completed in ' + executionTime.toFixed(2) + 's. WorkerJobID: ' + workerJob.id);
        return { success: true, executionTime, workerJobId: workerJob.id, botType };

    } catch (error: any) {
        const executionTime = (Date.now() - startTime) / 1000;
        const { botType, correlationId, runtimeType, workerTargetQueue } = taskData || {};
        console.error('[Orchestrator] Bot task ' + job.id + ' for botType ' + (botType || 'unknown') + ' (targetQueue: ' + (workerTargetQueue || 'unknown') + ') failed after ' + executionTime.toFixed(2) + 's: ' + error.message, error.stack);
        await releaseApiGatewayConcurrencySlot(botType || 'unknown', job.id, correlationId);
        botExecutionCounter.inc({ bot_type: botType || 'unknown', status: 'failed', service: 'orchestrator' });
        botExecutionDuration.observe({ bot_type: botType || 'unknown', service: 'orchestrator' }, executionTime);
        throw error;
    } finally {
        if (semaphoreIdentifier && taskData?.workerTargetQueue) {
            const semaphoreToRelease = semaphores.get(taskData.workerTargetQueue);
            if (semaphoreToRelease) {
                try { await semaphoreToRelease.release(semaphoreIdentifier); console.log('[Orchestrator] Semaphore released for targetQueue: ' + taskData.workerTargetQueue + ' ID: ' + semaphoreIdentifier); }
                catch (releaseError: any) { console.error('[Orchestrator] Error releasing semaphore for targetQueue: ' + taskData.workerTargetQueue + ': ' + releaseError.message); }
            } else { console.warn('[Orchestrator] Semaphore instance for targetQueue ' + taskData.workerTargetQueue + ' not found in map for release.'); }
        } else if (semaphoreIdentifier) { console.warn('[Orchestrator] Attempted to release semaphore ' + semaphoreIdentifier + ' but workerTargetQueue missing.'); }
    }
}, { connection: redisConnection, concurrency: parseInt(process.env.ORCHESTRATOR_MAIN_WORKER_CONCURRENCY || '20', 10), removeOnComplete: { count: 50 }, removeOnFail: { count: 20 } });

mainWorker.on('completed', (job) => console.log('Job ' + job.id + ' completed successfully'));
mainWorker.on('failed', (job, err) => console.error('Job ' + job?.id + ' failed: ' + err.message, err.stack));
mainWorker.on('stalled', (jobId) => console.warn('Job ' + jobId + ' stalled'));

async function cleanupOldJobs() {
    const maxAge = 7 * 24 * 3600 * 1000; // 7 days
    try {
        console.log('[Orchestrator] Cleaning old jobs from bot-tasks queue...');
        await botQueue.clean(maxAge, 1000, 'completed'); await botQueue.clean(maxAge, 1000, 'failed');
        console.log('[Orchestrator] Cleaning old jobs from worker queues in cache...');
        for (const [queueName, queue] of workerQueuesCache) {
            console.log('[Orchestrator] Cleaning old jobs from ' + queueName + '...');
            await queue.clean(maxAge, 500, 'completed'); await queue.clean(maxAge, 500, 'failed');
        }
        console.log('[Orchestrator] Job cleanup completed');
    } catch (error: any) { console.error('[Orchestrator] Error during job cleanup: ' + error.message); }
}

async function updateQueueMetrics() {
    try {
        const mainQ = 'bot-tasks';
        const mainCounts = await botQueue.getJobCounts('active', 'completed', 'delayed', 'failed', 'paused', 'waiting', 'waiting-children');
        for (const [state, count] of Object.entries(mainCounts)) { queueSizeGauge.set({ queue_name: mainQ, state }, count || 0); }

        for (const [qName, queue] of workerQueuesCache) {
            const counts = await queue.getJobCounts('active', 'completed', 'delayed', 'failed', 'paused', 'waiting', 'waiting-children');
            for (const [state, count] of Object.entries(counts)) { queueSizeGauge.set({ queue_name: qName, state }, count || 0); }
        }
    } catch (error: any) { console.error('[Orchestrator] Error updating queue metrics: ' + error.message); }
}

async function releaseApiGatewayConcurrencySlot(botType: string, jobId?: string | number | undefined, correlationId?: string) {
    if (!botType || botType === 'unknown') {
        console.warn('[Orchestrator] Invalid botType for API Gateway release: ' + botType + ' Job: ' + (jobId || 'unknown'));
        return;
    }
    const releaseUrl = API_GATEWAY_SERVICE_URL_BASE + '/admin/internal/release-concurrency/' + botType;
    try {
        console.log('[Orchestrator] Notifying API Gateway for slot release. BotType: ' + botType + ' URL: ' + releaseUrl);
        await axios.post(releaseUrl);
        console.log('[Orchestrator] API Gateway slot notified for release. BotType: ' + botType);
    } catch (error: any) {
        const errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('[Orchestrator] Failed to notify API Gateway for slot release. BotType: ' + botType + ' Error: ' + errMsg);
    }
}

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 3002;

app.get('/health', (req: express.Request, res: express.Response) => {
    const activeWorkerQueues = Array.from(workerQueuesCache.keys());
    const activeSemaphoreInfo: Record<string, any> = {};
    (activeWorkerQueues.length > 0 ? activeWorkerQueues : Array.from(semaphores.keys())).forEach(qName => {
        activeSemaphoreInfo[qName] = semaphoreConfigs.get(qName) || DEFAULT_SEMAPHORE_CONFIG;
    });
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'orchestrator', mainQueue: 'bot-tasks', activeWorkerQueues, semaphoreConfigurationMode: semaphoreConfigs.size > 0 ? 'Specific + Default' : 'Default Only', activeSemaphoreDetails: activeSemaphoreInfo, defaultSemaphoreConfig: DEFAULT_SEMAPHORE_CONFIG });
});

app.get('/metrics', async (req: express.Request, res: express.Response) => {
    try {
        await updateQueueMetrics(); await updateSemaphoreMetrics();
        const metrics = await getMetrics(); res.set('Content-Type', 'text/plain'); res.send(metrics);
    } catch (error: any) { console.error('Error getting metrics: ' + error.message); res.status(500).json({ error: 'Failed to get metrics' }); }
});

async function shutdown(signal: string) {
    console.log('[Orchestrator] Received ' + signal + '. Shutting down...');
    serviceHealthGauge.set({ service: 'orchestrator', version: '1.0.0' }, 0);
    try {
        await mainWorker.close(); await botQueue.close();
        for (const [, queue] of workerQueuesCache) { await queue.close(); }
        await redisConnection.quit();
        console.log('[Orchestrator] Shutdown complete.'); process.exit(0);
    } catch (err: any) { console.error('[Orchestrator] Error during shutdown: ' + err.message); process.exit(1); }
}

app.listen(PORT, () => {
    console.log('[Orchestrator] Metrics server running on port ' + PORT);
    updateQueueMetrics(); updateSemaphoreMetrics();
    serviceHealthGauge.set({ service: 'orchestrator', version: '1.0.0' }, 1);
});

console.log('Orchestrator started successfully. Redis: ' + REDIS_HOST);

setInterval(updateSemaphoreMetrics, 30000);
setInterval(cleanupOldJobs, 60 * 60 * 1000);
setInterval(updateQueueMetrics, 30000);

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app; 