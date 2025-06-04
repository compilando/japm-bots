import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { BotTask, getMetrics, botExecutionCounter } from '@bot-core/common';
import { swaggerSpec, swaggerJson } from './swagger';

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';

// Configurar Redis
const redis = new Redis({
    host: REDIS_HOST,
    port: 6379,
    maxRetriesPerRequest: null
});

// Configurar colas
const botQueue = new Queue('bot-tasks', { connection: redis });
const webhookQueue = new Queue('webhook-deliveries', { connection: redis });

// Configurar Bull Board para monitoreo de colas
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
    queues: [
        new BullMQAdapter(botQueue),
        new BullMQAdapter(webhookQueue)
    ],
    serverAdapter
});

// Middleware de seguridad
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // máximo 100 requests por ventana
    message: 'Too many requests from this IP'
});
app.use(limiter);

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
app.get('/health', (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    console.log(`💚 Health check desde IP: ${clientIp}`);

    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        queues: {
            'bot-tasks': botQueue.name,
            'webhook-deliveries': webhookQueue.name
        },
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Métricas de Prometheus
app.get('/metrics', async (req, res) => {
    try {
        const metrics = await getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get metrics' });
    }
});

/**
 * @swagger
 * /invoke:
 *   post:
 *     tags: [Bots]
 *     summary: Invocar un bot
 *     description: |
 *       Crea y encola un trabajo para ejecutar un bot específico.
 *       El resultado se enviará al webhook especificado cuando esté listo.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BotInvokeRequest'
 *           examples:
 *             python-analysis:
 *               summary: Bot Python para análisis de datos
 *               value:
 *                 botType: python
 *                 payload:
 *                   task: data_analysis
 *                   dataset: sales_2024
 *                   parameters:
 *                     algorithm: regression
 *                     features: [price, quantity, date]
 *                 webhookUrl: https://myapp.com/webhook/python-result
 *                 priority: 2
 *             node-api-test:
 *               summary: Bot Node.js para testing de APIs
 *               value:
 *                 botType: node
 *                 payload:
 *                   action: api_test
 *                   endpoints: ["/users", "/products"]
 *                   timeout: 5000
 *                 webhookUrl: https://myapp.com/webhook/node-result
 *                 priority: 3
 *             java-batch:
 *               summary: Bot Java para procesamiento batch
 *               value:
 *                 botType: java
 *                 payload:
 *                   operation: batch_process
 *                   records: 10000
 *                   batchSize: 1000
 *                 webhookUrl: https://myapp.com/webhook/java-result
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
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
app.post('/invoke', async (req, res) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
        const { botType, payload, webhookUrl, priority = 3 } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

        console.log(`🚀 [${requestId}] Nueva invocación de bot recibida`);
        console.log(`📊 [${requestId}] Bot Type: ${botType}, Priority: ${priority}, Client IP: ${clientIp}`);
        console.log(`📝 [${requestId}] Payload size: ${JSON.stringify(payload).length} bytes`);

        // Validación básica
        if (!['python', 'node', 'java'].includes(botType)) {
            console.log(`❌ [${requestId}] Validación fallida: Tipo de bot inválido: ${botType}`);
            return res.status(400).json({
                error: 'Tipo de bot inválido. Debe ser: python, node, o java',
                requestId
            });
        }

        if (!payload || !webhookUrl) {
            console.log(`❌ [${requestId}] Validación fallida: Faltan campos requeridos (payload: ${!!payload}, webhookUrl: ${!!webhookUrl})`);
            return res.status(400).json({
                error: 'payload y webhookUrl son requeridos',
                requestId
            });
        }

        // Validar URL del webhook
        try {
            new URL(webhookUrl);
            console.log(`✅ [${requestId}] Webhook URL válida: ${webhookUrl}`);
        } catch {
            console.log(`❌ [${requestId}] Validación fallida: URL de webhook inválida: ${webhookUrl}`);
            return res.status(400).json({
                error: 'webhookUrl debe ser una URL válida',
                requestId
            });
        }

        // Crear tarea de bot
        const botTask: Partial<BotTask> = {
            botType: botType as 'python' | 'node' | 'java',
            payload,
            webhookUrl,
            priority,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log(`🔄 [${requestId}] Encolando tarea de bot en cola 'bot-tasks'`);

        // Añadir a la cola de tareas
        const job = await botQueue.add('bot-task', botTask, {
            priority,
            removeOnComplete: { count: 50 },
            removeOnFail: { count: 20 },
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            }
        });

        const processingTime = Date.now() - startTime;

        console.log(`✅ [${requestId}] Tarea encolada exitosamente`);
        console.log(`📋 [${requestId}] Job ID: ${job.id}, Tiempo de procesamiento: ${processingTime}ms`);

        // Incrementar métricas
        botExecutionCounter.inc({ bot_type: botType, status: 'queued' });

        const queuePosition = await botQueue.getWaiting().then(jobs => jobs.length);
        console.log(`📊 [${requestId}] Posición en cola: ${queuePosition}, Priority: ${priority}`);

        res.json({
            status: 'enqueued',
            jobId: job.id,
            botType,
            priority,
            estimatedPosition: queuePosition,
            requestId,
            processingTimeMs: processingTime
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`❌ [${requestId}] Error procesando request: ${error}`);
        console.error(`⏱️ [${requestId}] Tiempo antes del error: ${processingTime}ms`);

        res.status(500).json({
            error: 'Error interno del servidor',
            requestId,
            processingTimeMs: processingTime,
            details: process.env.NODE_ENV === 'development' ? error : undefined
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
app.get('/job/:jobId', async (req, res) => {
    const startTime = Date.now();
    try {
        const { jobId } = req.params;
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

        console.log(`🔍 Consultando estado del job: ${jobId} desde IP: ${clientIp}`);

        const job = await botQueue.getJob(jobId);

        if (!job) {
            console.log(`❌ Job no encontrado: ${jobId}`);
            return res.status(404).json({
                error: 'Job no encontrado',
                jobId,
                timestamp: new Date().toISOString()
            });
        }

        const state = await job.getState();
        const queryTime = Date.now() - startTime;

        console.log(`✅ Estado del job ${jobId}: ${state}, consulta en ${queryTime}ms`);

        res.json({
            id: job.id,
            state,
            data: job.data,
            progress: job.progress,
            createdAt: new Date(job.timestamp),
            processedOn: job.processedOn ? new Date(job.processedOn) : null,
            finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
            failedReason: job.failedReason,
            queryTimeMs: queryTime
        });

    } catch (error) {
        const queryTime = Date.now() - startTime;
        console.error(`❌ Error consultando estado del job ${req.params.jobId}:`, error);
        res.status(500).json({
            error: 'Error al consultar estado del job',
            jobId: req.params.jobId,
            queryTimeMs: queryTime
        });
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
app.get('/stats', async (req, res) => {
    const startTime = Date.now();
    try {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        console.log(`📊 Consultando estadísticas desde IP: ${clientIp}`);

        const [waiting, active, completed, failed] = await Promise.all([
            botQueue.getWaiting(),
            botQueue.getActive(),
            botQueue.getCompleted(),
            botQueue.getFailed()
        ]);

        const [webhookWaiting, webhookActive, webhookCompleted, webhookFailed] = await Promise.all([
            webhookQueue.getWaiting(),
            webhookQueue.getActive(),
            webhookQueue.getCompleted(),
            webhookQueue.getFailed()
        ]);

        const queryTime = Date.now() - startTime;
        const stats = {
            botQueue: {
                waiting: waiting.length,
                active: active.length,
                completed: completed.length,
                failed: failed.length
            },
            webhookQueue: {
                waiting: webhookWaiting.length,
                active: webhookActive.length,
                completed: webhookCompleted.length,
                failed: webhookFailed.length
            },
            queryTimeMs: queryTime,
            timestamp: new Date().toISOString()
        };

        console.log(`✅ Estadísticas obtenidas en ${queryTime}ms - Bot Queue: ${waiting.length}W/${active.length}A/${completed.length}C/${failed.length}F`);
        console.log(`📤 Webhook Queue: ${webhookWaiting.length}W/${webhookActive.length}A/${webhookCompleted.length}C/${webhookFailed.length}F`);

        res.json(stats);

    } catch (error) {
        const queryTime = Date.now() - startTime;
        console.error(`❌ Error obteniendo estadísticas en ${queryTime}ms:`, error);
        res.status(500).json({
            error: 'Error al obtener estadísticas',
            queryTimeMs: queryTime,
            timestamp: new Date().toISOString()
        });
    }
});

// Swagger UI y documentación
app.get('/api-docs/swagger.json', swaggerJson);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: '🤖 Bot System API Gateway',
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
        service: '🤖 Bot System - API Gateway',
        version: '1.0.0',
        status: 'operational',
        endpoints: {
            documentation: '/api-docs',
            health: '/health',
            metrics: '/metrics',
            stats: '/stats',
            bullBoard: '/admin/queues'
        },
        botTypes: ['python', 'node', 'java'],
        timestamp: new Date().toISOString()
    });
});

// Montar Bull Board
app.use('/admin/queues', serverAdapter.getRouter());

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
    console.log(`🚀 API Gateway iniciado exitosamente`);
    console.log(`🌐 Puerto: ${PORT}`);
    console.log(`🗄️  Redis: ${REDIS_HOST}:6379`);
    console.log(`📊 Bull Board: http://localhost:${PORT}/admin/queues`);
    console.log(`📈 Métricas: http://localhost:${PORT}/metrics`);
    console.log(`📚 Swagger: http://localhost:${PORT}/api-docs`);
    console.log(`💚 Health: http://localhost:${PORT}/health`);
    console.log(`📋 Stats: http://localhost:${PORT}/stats`);
    console.log(`⚡ API Gateway listo para recibir requests`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Cerrando API Gateway...');
    console.log('📊 Cerrando colas...');
    await botQueue.close();
    await webhookQueue.close();
    console.log('🗄️  Cerrando conexión Redis...');
    await redis.quit();
    console.log('✅ API Gateway cerrado correctamente');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Cerrando API Gateway (SIGINT)...');
    await botQueue.close();
    await webhookQueue.close();
    await redis.quit();
    console.log('✅ API Gateway cerrado correctamente');
    process.exit(0);
}); 