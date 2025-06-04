import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { BotTask, getMetrics, botExecutionCounter, BotExecutionRequest, BotTypeConfig } from '@bot-core/common';
import { swaggerSpec, swaggerJson } from './swagger';
import { ConfigService } from './services/config.service';
import { ExecutionControlService } from './services/execution-control.service';
import { createAdminRoutes } from './routes/admin.routes';

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const API_GATEWAY_BASE_PATH = process.env.API_GATEWAY_BASE_PATH || '';

// Configurar Redis
const redis = new Redis({
    host: REDIS_HOST,
    port: 6379,
    maxRetriesPerRequest: null
});

// Configurar colas
const botQueue = new Queue<BotTask>('bot-tasks', { connection: redis });
const webhookQueue = new Queue('webhook-deliveries', { connection: redis });

// Initialize Services
const configService = new ConfigService(redis);
const executionControlService = new ExecutionControlService(redis, configService);

// Configurar Bull Board para monitoreo de colas
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(`${API_GATEWAY_BASE_PATH}/admin/queues`);

createBullBoard({
    queues: [
        new BullMQAdapter(botQueue),
        new BullMQAdapter(webhookQueue)
    ],
    serverAdapter
});

// Middleware de seguridad
app.use(helmet());

// Configuración de CORS más explícita
const allowedOrigins = [
    'http://localhost:3006', // Origen de tu admin-ui
    // Puedes añadir más orígenes si es necesario, ej. tu URL de producción
];

app.use(cors({
    origin: function (origin, callback) {
        // Permitir solicitudes sin 'origin' (como Postman, o de servidor a servidor si no es un navegador)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'La política CORS para este sitio no permite acceso desde el origen especificado.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'], // Asegúrate que x-api-key esté aquí
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'test' ? 10000 : 1000, // Max requests per windowMs. Higher for tests.
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

// Admin Routes
const adminRouter = createAdminRoutes(redis);
app.use(`${API_GATEWAY_BASE_PATH}/admin`, adminRouter);

// Swagger UI - accessible at /api-docs
app.use(`${API_GATEWAY_BASE_PATH}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get(`${API_GATEWAY_BASE_PATH}/swagger.json`, (req, res) => res.json(swaggerJson));

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check del API Gateway
 *     description: Verifica el estado de salud del servicio y la conectividad con las colas
 *     responses:
 *       200:
 *         description: Servicio saludable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
app.get(`${API_GATEWAY_BASE_PATH}/health`, (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    console.log(`[API-Gateway] 💚 Health check from IP: ${clientIp}`);

    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'api-gateway',
        queues: {
            'bot-tasks': botQueue.name,
            'webhook-deliveries': webhookQueue.name
        },
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Métricas de Prometheus
app.get(`${API_GATEWAY_BASE_PATH}/metrics`, async (req, res) => {
    try {
        const metrics = await getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error: any) {
        console.error('[API-Gateway] Failed to get metrics:', error);
        res.status(500).json({ error: 'Failed to get metrics', details: error.message });
    }
});

/**
 * @swagger
 * /invoke:
 *   post:
 *     tags: [Bots]
 *     summary: Invocar un bot o un grupo de bots
 *     description: |
 *       Crea y encola un trabajo para ejecutar un bot específico o un bot seleccionado de un grupo según reglas.
 *       Aplica controles de concurrencia y cadencia.
 *       El `target` puede ser `botType:<nombre-del-bot>` o `groupId:<nombre-del-grupo>`.
 *       El `webhookUrl` es requerido en el cuerpo de la solicitud.
 *       El resultado se enviará al webhook especificado cuando esté listo.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BotExecutionRequest'
 *           examples:
 *             specific-bot:
 *               summary: Invocar un bot específico
 *               value:
 *                 target: "botType:python-analyzer-v1"
 *                 webhookUrl: "https://your-app.com/webhook/results"
 *                 params:
 *                   task: data_analysis
 *                   dataset_id: "ds_12345"
 *                 correlationId: "user-request-abc-123"
 *                 priority: 2
 *             group-bots:
 *               summary: Invocar un grupo de bots
 *               value:
 *                 target: "groupId:data-validators"
 *                 webhookUrl: "https://your-app.com/webhook/validation"
 *                 params:
 *                   source_system: "crm"
 *                   data_format: "csv"
 *                 priority: 1
 *     responses:
 *       200:
 *         description: Bot encolado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BotInvokeResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Configuración de bot o grupo no encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 requestId: { type: string }
 *       429:
 *         description: Límite de concurrencia o cadencia alcanzado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 status: { type: string, enum: [rejected_concurrency, rejected_cadence] }
 *                 requestId: { type: string }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
app.post(`${API_GATEWAY_BASE_PATH}/invoke`, async (req, res) => {
    const startTime = Date.now();
    const executionRequest = req.body as BotExecutionRequest & { webhookUrl?: string };
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const requestId = executionRequest.correlationId || `req_${uuidv4()}`;

    console.log(`[API-Gateway] 🚀 [${requestId}] New bot invocation request from IP: ${clientIp}, Target: ${executionRequest.target}`);

    let selectedBotType: string | null = null;
    let botConfig: BotTypeConfig | null = null;
    let effectivelyFromGroup = false;
    let concurrencySlotAcquired = false;

    try {
        const { target, params, webhookUrl, priority: reqPriority } = executionRequest;

        if (!target || !webhookUrl) {
            console.warn(`[API-Gateway] ❌ [${requestId}] Validation failed: target and webhookUrl are required.`);
            return res.status(400).json({ error: 'target and webhookUrl are required', requestId });
        }
        try { new URL(webhookUrl); } catch {
            console.warn(`[API-Gateway] ❌ [${requestId}] Validation failed: webhookUrl is invalid: ${webhookUrl}`);
            return res.status(400).json({ error: 'webhookUrl must be a valid URL', requestId });
        }

        if (target.startsWith('groupId:')) {
            const groupId = target.substring('groupId:'.length);
            effectivelyFromGroup = true;
            console.log(`[API-Gateway] ℹ️ [${requestId}] Resolving bot from group: ${groupId}`);
            selectedBotType = await executionControlService.selectBotFromGroup(groupId, params);
            if (!selectedBotType) {
                console.warn(`[API-Gateway] ❌ [${requestId}] No bot could be selected from group ${groupId} with params: ${JSON.stringify(params)}`);
                return res.status(404).json({ error: `No bot could be selected from group ${groupId}. Check group config or request params.`, requestId });
            }
            console.log(`[API-Gateway] ✅ [${requestId}] Selected botType '${selectedBotType}' from group '${groupId}`);
        } else if (target.startsWith('botType:')) {
            selectedBotType = target.substring('botType:'.length);
        } else {
            console.warn(`[API-Gateway] ❌ [${requestId}] Invalid target format: ${target}`);
            return res.status(400).json({ error: "Invalid target format. Must be 'groupId:...' or 'botType:...'", requestId });
        }

        if (!selectedBotType) {
            console.error(`[API-Gateway]  Critical ❌ [${requestId}] Failed to determine bot type for execution after target processing.`);
            return res.status(500).json({ message: "Internal error: Failed to determine bot type.", requestId });
        }

        botConfig = await configService.getBotTypeConfig(selectedBotType);
        if (!botConfig) {
            console.warn(`[API-Gateway] ❌ [${requestId}] Bot type configuration for '${selectedBotType}' not found.`);
            return res.status(404).json({ error: `Bot type configuration for '${selectedBotType}' not found.`, requestId });
        }

        // Asegurarse que workerTargetQueue está presente en la configuración
        if (!botConfig.workerTargetQueue) {
            console.error(`[API-Gateway] Critical ❌ [${requestId}] Misconfiguration: workerTargetQueue is missing for botType '${selectedBotType}'.`);
            return res.status(500).json({ error: `Internal server error: workerTargetQueue not configured for bot type ${selectedBotType}.`, requestId });
        }

        const finalPriority = reqPriority || botConfig.defaultPriority || 3;

        // 1. Control de Concurrencia
        if (botConfig.concurrency && botConfig.concurrency.limit > 0) {
            console.log(`[API-Gateway] ⏳ [${requestId}] Attempting to acquire concurrency slot for ${selectedBotType} (limit: ${botConfig.concurrency.limit})`);
            const canExecute = await executionControlService.acquireConcurrencySlot(selectedBotType, botConfig.concurrency.limit);
            if (!canExecute) {
                console.warn(`[API-Gateway] 🚦 [${requestId}] Concurrency limit reached for bot type ${selectedBotType}.`);
                botExecutionCounter.inc({ bot_type: selectedBotType, status: 'rejected_concurrency', service: 'api-gateway' });
                return res.status(429).json({ error: `Concurrency limit reached for bot type ${selectedBotType}.`, status: 'rejected_concurrency', requestId });
            }
            concurrencySlotAcquired = true;
            console.log(`[API-Gateway] ✅ [${requestId}] Concurrency slot acquired for ${selectedBotType}.`);
        }

        // 2. Control de Cadencia
        if (botConfig.cadence && botConfig.cadence.intervalSeconds > 0) {
            console.log(`[API-Gateway] ⏳ [${requestId}] Checking cadence for ${selectedBotType} (interval: ${botConfig.cadence.intervalSeconds}s)`);
            const withinCadence = await executionControlService.checkAndSetCadence(selectedBotType, botConfig.cadence.intervalSeconds, botConfig.cadence.maxPerInterval);
            if (!withinCadence) {
                console.warn(`[API-Gateway] 🚦 [${requestId}] Cadence limit not met for bot type ${selectedBotType}.`);
                if (concurrencySlotAcquired) {
                    await executionControlService.releaseConcurrencySlot(selectedBotType);
                    console.log(`[API-Gateway] ↩️ [${requestId}] Concurrency slot released for ${selectedBotType} due to cadence failure.`);
                }
                botExecutionCounter.inc({ bot_type: selectedBotType, status: 'rejected_cadence', service: 'api-gateway' });
                return res.status(429).json({ error: `Cadence limit not met for bot type ${selectedBotType}. Please try again later.`, status: 'rejected_cadence', requestId });
            }
            console.log(`[API-Gateway] ✅ [${requestId}] Cadence check passed for ${selectedBotType}.`);
        }

        // Crear tarea de bot para BullMQ
        const taskData: BotTask = {
            id: requestId,
            botType: selectedBotType,
            runtimeType: botConfig.runtimeType,
            workerTargetQueue: botConfig.workerTargetQueue,
            payload: params || {},
            webhookUrl: webhookUrl!,
            priority: finalPriority,
            correlationId: requestId,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...(effectivelyFromGroup && { executionGroupId: target.substring('groupId:'.length) })
        };

        const jobOptions = {
            priority: finalPriority,
            removeOnComplete: { count: 1000, age: 24 * 3600 }, // Keep completed jobs for a day or 1000 count
            removeOnFail: { count: 5000, age: 7 * 24 * 3600 }, // Keep failed jobs for 7 days or 5000 count
            attempts: botConfig.retryAttempts || 3,
            backoff: { type: 'exponential', delay: 5000 }, // 5s, 10s, 20s for example
            jobId: requestId, // Use unique requestId as Job ID for idempotency and traceability
        };

        console.log(`[API-Gateway] 🔄 [${requestId}] Enqueuing task for bot '${selectedBotType}' (runtime: ${botConfig.runtimeType}) with JobID: ${jobOptions.jobId}`);
        const job: Job<BotTask> = await botQueue.add('bot-task', taskData, jobOptions);

        const processingTime = Date.now() - startTime;
        console.log(`[API-Gateway] ✅ [${requestId}] Task enqueued successfully. Job ID: ${job.id}. Processing time: ${processingTime}ms`);

        botExecutionCounter.inc({ bot_type: selectedBotType, status: 'enqueued', service: 'api-gateway' });

        res.status(200).json({
            status: 'enqueued',
            jobId: job.id,
            botType: selectedBotType,
            correlationId: requestId,
            priority: finalPriority,
            message: `Bot task for '${selectedBotType}' enqueued successfully.`,
            processingTimeMs: processingTime
        });

    } catch (error: any) {
        const processingTime = Date.now() - startTime;
        console.error(`[API-Gateway] ❌ [${requestId}] Error processing /invoke request:`, error);
        if (concurrencySlotAcquired && selectedBotType) {
            try {
                console.warn(`[API-Gateway] ↩️ [${requestId}] Attempting to release concurrency slot for ${selectedBotType} due to error: ${error.message}`);
                await executionControlService.releaseConcurrencySlot(selectedBotType);
            } catch (releaseError: any) {
                console.error(`[API-Gateway] Critical ❌ [${requestId}] Failed to release concurrency slot for ${selectedBotType} during error handling:`, releaseError);
            }
        }
        res.status(500).json({
            error: 'Internal Server Error while processing bot invocation.',
            details: error.message,
            requestId
        });
    }
});

/**
 * @swagger
 * /job/{jobId}:
 *   get:
 *     tags: [Jobs]
 *     summary: Consultar estado de un trabajo
 *     description: Obtiene información detallada sobre el estado y progreso de un trabajo específico
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID único del trabajo
 *         example: "12345"
 *     responses:
 *       200:
 *         description: Estado del trabajo obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobStatus'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
app.get(`${API_GATEWAY_BASE_PATH}/jobs/:jobId/status`, async (req, res) => {
    const { jobId } = req.params;
    try {
        const job = await botQueue.getJob(jobId) as Job<BotTask> | null;
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        const state = await job.getState();
        const failedReason = job.failedReason;
        const returnValue = job.returnvalue; // If any

        res.json({
            jobId: job.id,
            name: job.name,
            state,
            progress: job.progress,
            timestamp: job.timestamp,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason,
            returnValue,
            data: job.data, // This is BotTask
        });
    } catch (error: any) {
        console.error(`[API-Gateway] Error fetching status for job ${jobId}:`, error);
        res.status(500).json({ error: 'Failed to get job status', details: error.message });
    }
});

/**
 * @swagger
 * /stats:
 *   get:
 *     tags: [Stats]
 *     summary: Estadísticas de las colas
 *     description: |
 *       Obtiene estadísticas en tiempo real de todas las colas del sistema,
 *       incluyendo trabajos de bots y entregas de webhooks
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueueStats'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
app.get(`${API_GATEWAY_BASE_PATH}/jobs/stats`, async (req, res) => {
    try {
        const [botCounts, webhookCounts] = await Promise.all([
            botQueue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed', 'paused'),
            webhookQueue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed', 'paused')
        ]);
        res.json({
            botQueue: botCounts,
            webhookQueue: webhookCounts
        });
    } catch (error: any) {
        console.error('[API-Gateway] Error fetching job stats:', error);
        res.status(500).json({ error: 'Failed to get job stats', details: error.message });
    }
});

// Middleware para Bull Board UI
app.use(`${API_GATEWAY_BASE_PATH}/admin/queues`, serverAdapter.getRouter());

// Graceful Shutdown
const gracefulShutdown = async (signal: string) => {
    console.log(`[API-Gateway] 收到信号 ${signal}. Iniciando cierre ordenado...`);
    Promise.all([
        botQueue.close(),
        webhookQueue.close(),
        redis.quit()
    ]).then(() => {
        console.log('[API-Gateway] Conexiones a BullMQ y Redis cerradas.');
        process.exit(0);
    }).catch(err => {
        console.error('[API-Gateway] Error durante el cierre de BullMQ/Redis:', err);
        process.exit(1);
    });

    // Forzamos el cierre si no se completa en un tiempo prudencial
    setTimeout(() => {
        console.error('[API-Gateway] Cierre ordenado tardó demasiado. Forzando salida.');
        process.exit(1);
    }, 10000); // 10 segundos de gracia
};

// Capturar señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Iniciar servidor
// Store the server instance for graceful shutdown
const server = app.listen(PORT, () => {
    console.log(`[API-Gateway] 🚀 API Gateway escuchando en http://localhost:${PORT}${API_GATEWAY_BASE_PATH}`);
    console.log(`[API-Gateway] 📊 Bull Board disponible en http://localhost:${PORT}${API_GATEWAY_BASE_PATH}/admin/queues`);
    console.log(`[API-Gateway] 📚 Swagger API docs en http://localhost:${PORT}${API_GATEWAY_BASE_PATH}/api-docs`);
    if (process.env.ADMIN_API_KEY) {
        console.log(`[API-Gateway] 🔑 Admin API Key está configurada.`);
    } else {
        console.warn('[API-Gateway] ⚠️ ADVERTENCIA: ADMIN_API_KEY no está configurada. Las rutas de admin no serán seguras.');
    }
});

// Export app for testing or other uses if needed
export default app; 