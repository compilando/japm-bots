import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import axios from 'axios';
import {
    WebhookDelivery,
    webhookDeliveryCounter,
    webhookDeliveryDuration
} from '@bot-core/common';
import { swaggerSpec, swaggerJson } from './swagger';

const app = express();
const PORT = process.env.WEBHOOK_MANAGER_PORT || 4000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const MAX_RETRIES = parseInt(process.env.WEBHOOK_MAX_RETRIES || '5');
const RETRY_DELAY = parseInt(process.env.WEBHOOK_RETRY_DELAY || '1000');

// Configurar Redis
const redis = new Redis({
    host: REDIS_HOST,
    port: 6379,
    maxRetriesPerRequest: null
});

// Configurar cola de webhooks
const webhookQueue = new Queue('webhook-deliveries', { connection: redis });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check del Webhook Manager
 *     description: Verifica el estado de salud del servicio y la conectividad con la cola
 *     responses:
 *       200:
 *         description: Servicio saludable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
app.get('/health', (req: express.Request, res: express.Response) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    console.log(`💚 [WEBHOOK-MANAGER] Health check desde IP: ${clientIp}`);

    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        queue: webhookQueue.name,
        maxRetries: MAX_RETRIES,
        retryDelay: RETRY_DELAY,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Swagger UI y documentación
app.get('/api-docs/swagger.json', swaggerJson);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: '📤 Bot System Webhook Manager',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true
    }
}));

// Ruta raíz con información del servicio
app.get('/', (req, res) => {
    res.json({
        service: '📤 Bot System - Webhook Manager',
        version: '1.0.0',
        status: 'operational',
        endpoints: {
            documentation: '/api-docs',
            health: '/health',
            metrics: '/metrics',
            stats: '/stats',
            deliver: '/deliver'
        },
        features: [
            'Webhook delivery with retries',
            'Exponential backoff',
            'Queue-based processing',
            'Delivery tracking'
        ],
        timestamp: new Date().toISOString()
    });
});

// Métricas de Prometheus
app.get('/metrics', async (req: express.Request, res: express.Response) => {
    try {
        const { getMetrics } = await import('@bot-core/common');
        const metrics = await getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error) {
        console.error('Error getting metrics:', error);
        res.status(500).json({ error: 'Failed to get metrics' });
    }
});

/**
 * @swagger
 * /deliver:
 *   post:
 *     tags: [Webhooks]
 *     summary: Encolar entrega de webhook
 *     description: |
 *       Recibe un resultado de bot y lo encola para entrega vía webhook.
 *       El sistema manejará automáticamente los reintentos en caso de fallas.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebhookDeliveryRequest'
 *           examples:
 *             python-result:
 *               $ref: '#/components/examples/PythonBotResult'
 *             node-result:
 *               $ref: '#/components/examples/NodeBotResult'
 *             java-result:
 *               $ref: '#/components/examples/JavaBotResult'
 *     responses:
 *       200:
 *         description: Webhook encolado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebhookDeliveryResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
app.post('/deliver', async (req, res) => {
    const deliveryId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
        const { jobId, result, webhookUrl } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

        console.log(`📥 [${deliveryId}] Nueva entrega de webhook recibida`);
        console.log(`🎯 [${deliveryId}] Job ID: ${jobId}, Client IP: ${clientIp}`);
        console.log(`📊 [${deliveryId}] Bot Type: ${result?.botType || 'unknown'}, Success: ${result?.success}`);
        console.log(`🌐 [${deliveryId}] Webhook URL: ${webhookUrl}`);

        if (!jobId || !result || !webhookUrl) {
            console.log(`❌ [${deliveryId}] Validación fallida: Faltan campos requeridos (jobId: ${!!jobId}, result: ${!!result}, webhookUrl: ${!!webhookUrl})`);
            return res.status(400).json({
                error: 'jobId, result y webhookUrl son requeridos',
                deliveryId
            });
        }

        // Validar URL del webhook
        try {
            new URL(webhookUrl);
            console.log(`✅ [${deliveryId}] URL del webhook válida`);
        } catch {
            console.log(`❌ [${deliveryId}] Validación fallida: URL de webhook inválida: ${webhookUrl}`);
            return res.status(400).json({
                error: 'webhookUrl debe ser una URL válida',
                deliveryId
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

        console.log(`🔄 [${deliveryId}] Encolando entrega de webhook`);
        console.log(`📝 [${deliveryId}] Payload size: ${JSON.stringify(webhookDelivery).length} bytes`);

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

        const processingTime = Date.now() - startTime;

        console.log(`✅ [${deliveryId}] Webhook encolado exitosamente`);
        console.log(`📋 [${deliveryId}] Delivery Job ID: ${job.id}, Tiempo de procesamiento: ${processingTime}ms`);
        console.log(`🔄 [${deliveryId}] Max reintentos: ${MAX_RETRIES}, Delay inicial: ${RETRY_DELAY}ms`);

        res.json({
            status: 'queued',
            deliveryId: job.id,
            webhookUrl,
            maxRetries: MAX_RETRIES,
            processingTimeMs: processingTime,
            requestId: deliveryId
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`❌ [${deliveryId}] Error encolando entrega de webhook:`, error);
        console.error(`⏱️ [${deliveryId}] Tiempo antes del error: ${processingTime}ms`);

        res.status(500).json({
            error: 'Error interno del servidor',
            deliveryId,
            processingTimeMs: processingTime
        });
    }
});

/**
 * @swagger
 * /delivery/{deliveryId}:
 *   get:
 *     tags: [Deliveries]
 *     summary: Consultar estado de una entrega
 *     description: Obtiene información detallada sobre el estado de una entrega de webhook específica
 *     parameters:
 *       - in: path
 *         name: deliveryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID único de la entrega
 *         example: "67890"
 *     responses:
 *       200:
 *         description: Estado de la entrega obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeliveryStatus'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
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

/**
 * @swagger
 * /stats:
 *   get:
 *     tags: [Stats]
 *     summary: Estadísticas de entregas de webhooks
 *     description: |
 *       Obtiene estadísticas en tiempo real de las entregas de webhooks,
 *       incluyendo entregas pendientes, activas, completadas y fallidas
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebhookStats'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
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
    const workerId = `wh_${job.id}_${Date.now()}`;

    try {
        const { jobId, result, webhookUrl, attempt = 1 } = job.data as WebhookDelivery;

        console.log(`📤 [${workerId}] Iniciando entrega de webhook`);
        console.log(`🎯 [${workerId}] Job ID: ${jobId}, Intento: ${attempt}/${MAX_RETRIES}`);
        console.log(`🌐 [${workerId}] URL destino: ${webhookUrl}`);
        console.log(`📊 [${workerId}] Bot Type: ${result?.botType || 'unknown'}, Success: ${result?.success}`);
        console.log(`📦 [${workerId}] Payload size: ${JSON.stringify(result).length} bytes`);

        // Actualizar progreso
        console.log(`📊 [${workerId}] Progreso: 25% - Preparando entrega`);
        job.updateProgress(25);

        console.log(`🚀 [${workerId}] Enviando HTTP POST a webhook`);
        console.log(`⏱️ [${workerId}] Timeout configurado: 30 segundos`);

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

        console.log(`📊 [${workerId}] Progreso: 75% - Respuesta recibida`);
        job.updateProgress(75);

        // Verificar respuesta exitosa
        if (response.status >= 200 && response.status < 300) {
            const deliveryTime = (Date.now() - startTime) / 1000;

            // Registrar métricas exitosas
            webhookDeliveryDuration.observe({ status: 'success' }, deliveryTime);
            webhookDeliveryCounter.inc({ status: 'success' });

            console.log(`✅ [${workerId}] Webhook entregado exitosamente en ${deliveryTime}s`);
            console.log(`📊 [${workerId}] Status HTTP: ${response.status}, Content-Type: ${response.headers['content-type']}`);
            console.log(`📈 [${workerId}] Métricas actualizadas: success++, duration: ${deliveryTime}s`);

            console.log(`📊 [${workerId}] Progreso: 100% - Entrega completada`);
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

        console.error(`❌ [${workerId}] Entrega de webhook falló después de ${deliveryTime}s`);
        console.error(`🔍 [${workerId}] Job ID: ${jobId}, Intento: ${attempt}/${MAX_RETRIES}`);
        console.error(`💥 [${workerId}] Error:`, error);

        // Registrar métricas de fallo
        webhookDeliveryCounter.inc({ status: 'failed' });
        webhookDeliveryDuration.observe({ status: 'failed' }, deliveryTime);

        console.log(`📈 [${workerId}] Métricas actualizadas: failed++, duration: ${deliveryTime}s`);

        // Determinar si es un error temporal o permanente
        const isTemporaryError = axios.isAxiosError(error) && (
            error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND' ||
            (error.response && error.response.status >= 500)
        );

        if (isTemporaryError && attempt < MAX_RETRIES) {
            console.log(`🔄 [${workerId}] Error temporal, se reintentará (${attempt}/${MAX_RETRIES})`);
            console.log(`⏰ [${workerId}] Próximo intento en: ${RETRY_DELAY * Math.pow(2, attempt - 1)}ms`);
        } else {
            console.log(`💀 [${workerId}] Error permanente o máx. reintentos alcanzados (${attempt}/${MAX_RETRIES})`);
        }

        // Logging específico por tipo de error
        if (axios.isAxiosError(error)) {
            if (error.response) {
                console.error(`🌐 [${workerId}] HTTP Error: ${error.response.status} ${error.response.statusText}`);
                console.error(`📦 [${workerId}] Response data:`, JSON.stringify(error.response.data).substring(0, 200));
            } else if (error.code) {
                console.error(`🔌 [${workerId}] Network Error: ${error.code} - ${error.message}`);
            }
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
    console.log(`✅ [WEBHOOK-WORKER] Entrega ${job.id} completada exitosamente`);
});

webhookWorker.on('failed', (job, err) => {
    console.error(`❌ [WEBHOOK-WORKER] Entrega ${job?.id} falló:`, err.message);
});

webhookWorker.on('stalled', (jobId) => {
    console.warn(`⚠️ [WEBHOOK-WORKER] Entrega ${jobId} se atoró (stalled)`);
});

webhookWorker.on('error', (err) => {
    console.error(`💥 [WEBHOOK-WORKER] Error en worker:`, err);
});

webhookWorker.on('progress', (job, progress) => {
    console.log(`📊 [WEBHOOK-WORKER] Entrega ${job.id} progreso: ${progress}%`);
});

console.log(`🚀 [WEBHOOK-WORKER] Worker iniciado exitosamente con concurrencia: 10`);

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
    console.log(`🚀 Webhook Manager iniciado exitosamente`);
    console.log(`🌐 Puerto: ${PORT}`);
    console.log(`🗄️  Redis: ${REDIS_HOST}:6379`);
    console.log(`🔄 Max reintentos: ${MAX_RETRIES}`);
    console.log(`⏱️  Delay de reintentos: ${RETRY_DELAY}ms`);
    console.log(`📚 Swagger: http://localhost:${PORT}/api-docs`);
    console.log(`💚 Health: http://localhost:${PORT}/health`);
    console.log(`📋 Stats: http://localhost:${PORT}/stats`);
    console.log(`📤 Endpoint delivery: http://localhost:${PORT}/deliver`);
    console.log(`⚡ Webhook Manager listo para procesar entregas`);
});

// Graceful shutdown
async function shutdown() {
    console.log('🛑 Cerrando Webhook Manager...');
    console.log('👷 Cerrando worker...');

    try {
        await webhookWorker.close();
        console.log('📊 Cerrando colas...');
        await webhookQueue.close();
        console.log('🗄️  Cerrando conexión Redis...');
        await redis.quit();
        console.log('✅ Webhook Manager cerrado correctamente');
    } catch (error) {
        console.error('❌ Error durante el cierre:', error);
    }

    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('🚀 Webhook Manager iniciado exitosamente');
console.log(`📍 Redis: ${REDIS_HOST}:6379`);
console.log(`🎯 Listo para procesar entregas de webhooks...`);

// Ejecutar estadísticas iniciales
logWebhookStats(); 