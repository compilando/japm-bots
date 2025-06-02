import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import axios from 'axios';
import {
    WebhookDelivery,
    webhookDeliveryCounter,
    webhookDeliveryDuration
} from '@bot-core/common';

const app = express();
const PORT = process.env.WEBHOOK_MANAGER_PORT || 4000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const MAX_RETRIES = parseInt(process.env.WEBHOOK_MAX_RETRIES || '5');
const RETRY_DELAY = parseInt(process.env.WEBHOOK_RETRY_DELAY || '1000');

// Configurar Redis
const redis = new Redis({
    host: REDIS_HOST,
    port: 6379,
    maxRetriesPerRequest: 3
});

// Configurar cola de webhooks
const webhookQueue = new Queue('webhook-deliveries', { connection: redis });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        queue: webhookQueue.name
    });
});

// Endpoint para recibir resultados de bots y encolar webhooks
app.post('/deliver', async (req, res) => {
    try {
        const { jobId, result, webhookUrl } = req.body;

        if (!jobId || !result || !webhookUrl) {
            return res.status(400).json({
                error: 'jobId, result y webhookUrl son requeridos'
            });
        }

        // Validar URL del webhook
        try {
            new URL(webhookUrl);
        } catch {
            return res.status(400).json({
                error: 'webhookUrl debe ser una URL válida'
            });
        }

        // Crear delivery de webhook
        const webhookDelivery: Partial<WebhookDelivery> = {
            jobId,
            result,
            webhookUrl,
            attempt: 1,
            maxAttempts: MAX_RETRIES,
            createdAt: new Date()
        };

        // Añadir a la cola con configuración de reintentos
        const job = await webhookQueue.add('webhook-delivery', webhookDelivery, {
            attempts: MAX_RETRIES,
            backoff: {
                type: 'exponential',
                delay: RETRY_DELAY
            },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 50 }
        });

        console.log(`📤 Webhook delivery queued for job ${jobId}: ${job.id}`);

        res.json({
            status: 'queued',
            deliveryId: job.id,
            webhookUrl,
            maxRetries: MAX_RETRIES
        });

    } catch (error) {
        console.error('Error queuing webhook delivery:', error);
        res.status(500).json({
            error: 'Error interno del servidor'
        });
    }
});

// Endpoint para consultar estado de una entrega
app.get('/delivery/:deliveryId', async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const job = await webhookQueue.getJob(deliveryId);

        if (!job) {
            return res.status(404).json({ error: 'Delivery no encontrada' });
        }

        const state = await job.getState();

        res.json({
            id: job.id,
            state,
            data: job.data,
            attemptsMade: job.attemptsMade,
            createdAt: new Date(job.timestamp),
            processedOn: job.processedOn ? new Date(job.processedOn) : null,
            finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
            failedReason: job.failedReason
        });

    } catch (error) {
        console.error('Error getting delivery status:', error);
        res.status(500).json({ error: 'Error al consultar estado de la entrega' });
    }
});

// Endpoint para obtener estadísticas de entregas
app.get('/stats', async (req, res) => {
    try {
        const [waiting, active, completed, failed] = await Promise.all([
            webhookQueue.getWaiting(),
            webhookQueue.getActive(),
            webhookQueue.getCompleted(),
            webhookQueue.getFailed()
        ]);

        res.json({
            webhookDeliveries: {
                waiting: waiting.length,
                active: active.length,
                completed: completed.length,
                failed: failed.length
            }
        });

    } catch (error) {
        console.error('Error getting webhook stats:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// Worker para procesar entregas de webhooks
const webhookWorker = new Worker('webhook-deliveries', async (job) => {
    const startTime = Date.now();

    try {
        const { jobId, result, webhookUrl, attempt = 1 } = job.data as WebhookDelivery;

        console.log(`🔔 Delivering webhook for job ${jobId} (attempt ${attempt}/${MAX_RETRIES})`);
        console.log(`📍 Target URL: ${webhookUrl}`);

        // Actualizar progreso
        job.updateProgress(25);

        // Realizar entrega del webhook
        const response = await axios.post(webhookUrl, result, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Bot-Core-Webhook-Manager/1.0',
                'X-Bot-Job-Id': jobId,
                'X-Delivery-Attempt': attempt.toString()
            },
            validateStatus: (status) => status >= 200 && status < 300
        });

        job.updateProgress(75);

        // Verificar respuesta exitosa
        if (response.status >= 200 && response.status < 300) {
            const deliveryTime = (Date.now() - startTime) / 1000;

            // Registrar métricas exitosas
            webhookDeliveryDuration.observe({ status: 'success' }, deliveryTime);
            webhookDeliveryCounter.inc({ status: 'success' });

            console.log(`✅ Webhook delivered successfully for job ${jobId} in ${deliveryTime}s`);
            console.log(`📊 Response status: ${response.status}`);

            job.updateProgress(100);

            return {
                success: true,
                status: response.status,
                deliveryTime,
                attempt,
                responseHeaders: response.headers
            };
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

    } catch (error) {
        const deliveryTime = (Date.now() - startTime) / 1000;
        const { jobId, attempt = 1 } = job.data;

        console.error(`❌ Webhook delivery failed for job ${jobId} (attempt ${attempt}):`, error);

        // Registrar métricas de fallo
        webhookDeliveryCounter.inc({ status: 'failed' });
        webhookDeliveryDuration.observe({ status: 'failed' }, deliveryTime);

        // Determinar si es un error temporal o permanente
        const isTemporaryError = axios.isAxiosError(error) && (
            error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND' ||
            (error.response && error.response.status >= 500)
        );

        if (isTemporaryError && attempt < MAX_RETRIES) {
            console.log(`🔄 Temporary error, will retry (${attempt}/${MAX_RETRIES})`);
        } else {
            console.log(`💀 Permanent error or max retries reached (${attempt}/${MAX_RETRIES})`);
        }

        throw new Error(
            error instanceof Error ? error.message : 'Unknown webhook delivery error'
        );
    }
}, {
    connection: redis,
    concurrency: 10, // Procesar hasta 10 entregas simultáneamente
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 }
});

// Monitoreo de eventos del worker
webhookWorker.on('completed', (job) => {
    console.log(`✅ Webhook delivery ${job.id} completed successfully`);
});

webhookWorker.on('failed', (job, err) => {
    console.error(`❌ Webhook delivery ${job?.id} failed:`, err.message);
});

webhookWorker.on('stalled', (jobId) => {
    console.warn(`⚠️  Webhook delivery ${jobId} stalled`);
});

webhookWorker.on('progress', (job, progress) => {
    console.log(`📊 Webhook delivery ${job.id} progress: ${progress}%`);
});

// Función para limpiar entregas antiguas
async function cleanupOldDeliveries() {
    try {
        console.log('🧹 Cleaning up old webhook deliveries...');

        // Limpiar entregas completadas y fallidas antiguas
        await webhookQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'); // 24 horas
        await webhookQueue.clean(7 * 24 * 60 * 60 * 1000, 100, 'failed'); // 7 días

        console.log('✅ Webhook delivery cleanup completed');
    } catch (error) {
        console.error('❌ Error during webhook delivery cleanup:', error);
    }
}

// Ejecutar limpieza cada hora
setInterval(cleanupOldDeliveries, 60 * 60 * 1000);

// Función para mostrar estadísticas
async function logWebhookStats() {
    try {
        const waiting = await webhookQueue.getWaiting();
        const active = await webhookQueue.getActive();

        console.log(`📊 Webhook Stats - Waiting: ${waiting.length}, Active: ${active.length}`);
    } catch (error) {
        console.error('Error getting webhook stats:', error);
    }
}

// Mostrar estadísticas cada 5 minutos
setInterval(logWebhookStats, 5 * 60 * 1000);

// Manejo de errores global
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Error interno del servidor',
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Webhook Manager running on port ${PORT}`);
    console.log(`📍 Redis: ${REDIS_HOST}:6379`);
    console.log(`🔄 Max retries: ${MAX_RETRIES}`);
    console.log(`⏱️  Retry delay: ${RETRY_DELAY}ms`);
});

// Graceful shutdown
async function shutdown() {
    console.log('🛑 Shutting down Webhook Manager...');

    try {
        await webhookWorker.close();
        await webhookQueue.close();
        await redis.quit();
        console.log('✅ Webhook Manager shutdown completed');
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
    }

    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('🚀 Webhook Manager started successfully');
console.log('🎯 Ready to process webhook deliveries...');

// Ejecutar estadísticas iniciales
logWebhookStats(); 