import { Worker } from 'bullmq';
import Redis from 'ioredis';
import axios from 'axios';
import express from 'express';
import {
    botExecutionCounter,
    botExecutionDuration,
    getMetrics,
    serviceHealthGauge
} from '@bot-core/common';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const WEBHOOK_MANAGER_URL = process.env.WEBHOOK_MANAGER_URL || 'http://webhook-manager:4000';
const BOT_TYPES = ['python', 'node', 'java'];

// Configurar Redis
const redis = new Redis({
    host: REDIS_HOST,
    port: 6379,
    maxRetriesPerRequest: null
});

// Simuladores de ejecución por tipo de bot
const botSimulators = {
    python: async (payload: any) => {
        const executionTime = 2000 + Math.random() * 3000; // 2-5 segundos
        console.log(`🐍 [BOT-PYTHON] Iniciando simulación por ${executionTime}ms`);

        await new Promise(resolve => setTimeout(resolve, executionTime));

        const result = {
            language: 'Python',
            version: '3.11.0',
            result: `Processed ${JSON.stringify(payload)} with Python`,
            executionTime: executionTime,
            libraries: ['numpy', 'pandas', 'requests'],
            output: `Python bot execution completed successfully\nInput: ${JSON.stringify(payload)}\nProcessed at: ${new Date().toISOString()}`
        };

        console.log(`🐍 [BOT-PYTHON] Simulación completada: ${result.libraries.length} librerías utilizadas`);
        return result;
    },

    node: async (payload: any) => {
        const executionTime = 1000 + Math.random() * 2000; // 1-3 segundos
        console.log(`🟢 [BOT-NODE] Iniciando simulación por ${executionTime}ms`);

        await new Promise(resolve => setTimeout(resolve, executionTime));

        const result = {
            language: 'Node.js',
            version: '18.19.0',
            result: `Processed ${JSON.stringify(payload)} with Node.js`,
            executionTime: executionTime,
            modules: ['axios', 'lodash', 'moment'],
            output: `Node.js bot execution completed successfully\nInput: ${JSON.stringify(payload)}\nProcessed at: ${new Date().toISOString()}`
        };

        console.log(`🟢 [BOT-NODE] Simulación completada: ${result.modules.length} módulos utilizados`);
        return result;
    },

    java: async (payload: any) => {
        const executionTime = 3000 + Math.random() * 4000; // 3-7 segundos
        console.log(`☕ [BOT-JAVA] Iniciando simulación por ${executionTime}ms`);

        await new Promise(resolve => setTimeout(resolve, executionTime));

        const result = {
            language: 'Java',
            version: '17.0.0',
            result: `Processed ${JSON.stringify(payload)} with Java`,
            executionTime: executionTime,
            libraries: ['Spring Boot', 'Apache Commons', 'Jackson'],
            output: `Java bot execution completed successfully\nInput: ${JSON.stringify(payload)}\nProcessed at: ${new Date().toISOString()}`
        };

        console.log(`☕ [BOT-JAVA] Simulación completada: ${result.libraries.length} librerías utilizadas`);
        return result;
    }
};

// Función para simular posibles errores
function shouldSimulateError(): boolean {
    return Math.random() < 0.05; // 5% probabilidad de error
}

// Configurar workers para cada tipo de bot
BOT_TYPES.forEach(botType => {
    const queueName = `bot-${botType}-tasks`;

    const worker = new Worker(queueName, async (job) => {
        const startTime = Date.now();

        try {
            const { originalJobId, payload, webhookUrl, semaphoreIdentifier } = job.data;

            console.log(`🤖 [WORKER-${botType.toUpperCase()}] Iniciando ejecución de bot`);
            console.log(`📋 [WORKER-${botType.toUpperCase()}] Job ID: ${job.id}, Original Job: ${originalJobId}`);
            console.log(`🔐 [WORKER-${botType.toUpperCase()}] Semáforo: ${semaphoreIdentifier}`);
            console.log(`📝 [WORKER-${botType.toUpperCase()}] Payload size: ${JSON.stringify(payload).length} bytes`);
            console.log(`📤 [WORKER-${botType.toUpperCase()}] Webhook URL: ${webhookUrl}`);

            // Simular error ocasional
            if (shouldSimulateError()) {
                console.log(`⚠️ [WORKER-${botType.toUpperCase()}] Simulando error para testing`);
                throw new Error(`Simulated ${botType} bot execution error`);
            }

            // Actualizar progreso
            console.log(`📊 [WORKER-${botType.toUpperCase()}] Progreso: 25% - Iniciando simulación`);
            job.updateProgress(25);

            // Ejecutar simulador específico del bot
            const simulator = botSimulators[botType as keyof typeof botSimulators];
            if (!simulator) {
                throw new Error(`No simulator found for bot type: ${botType}`);
            }

            console.log(`📊 [WORKER-${botType.toUpperCase()}] Progreso: 50% - Ejecutando lógica de bot`);
            job.updateProgress(50);

            // Ejecutar bot
            const result = await simulator(payload);

            console.log(`📊 [WORKER-${botType.toUpperCase()}] Progreso: 75% - Bot ejecutado, preparando webhook`);
            job.updateProgress(75);

            // Enviar resultado al webhook manager
            const webhookPayload = {
                jobId: originalJobId,
                result: {
                    success: true,
                    botType: botType.toUpperCase(),
                    data: result,
                    timestamp: new Date().toISOString(),
                    executionNode: process.env.HOSTNAME || 'unknown',
                    semaphoreIdentifier
                },
                webhookUrl
            };

            console.log(`📤 [WORKER-${botType.toUpperCase()}] Enviando resultado al webhook manager`);
            console.log(`🎯 [WORKER-${botType.toUpperCase()}] Webhook Manager URL: ${WEBHOOK_MANAGER_URL}/deliver`);
            console.log(`📦 [WORKER-${botType.toUpperCase()}] Payload size: ${JSON.stringify(webhookPayload).length} bytes`);

            await axios.post(`${WEBHOOK_MANAGER_URL}/deliver`, webhookPayload, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log(`📊 [WORKER-${botType.toUpperCase()}] Progreso: 100% - Webhook enviado exitosamente`);
            job.updateProgress(100);

            // Registrar métricas exitosas
            const executionTime = (Date.now() - startTime) / 1000;
            botExecutionDuration.observe({ bot_type: botType }, executionTime);
            botExecutionCounter.inc({ bot_type: botType, status: 'completed' });

            console.log(`✅ [WORKER-${botType.toUpperCase()}] Bot completado exitosamente en ${executionTime}s`);
            console.log(`📈 [WORKER-${botType.toUpperCase()}] Métricas actualizadas: completed++, duration: ${executionTime}s`);

            return {
                success: true,
                botType,
                executionTime,
                webhookDelivered: true
            };

        } catch (error) {
            const executionTime = (Date.now() - startTime) / 1000;
            const { originalJobId, webhookUrl } = job.data;

            console.error(`❌ [WORKER-${botType.toUpperCase()}] Bot falló después de ${executionTime}s:`, error);
            console.error(`🔍 [WORKER-${botType.toUpperCase()}] Job ID: ${job.id}, Original Job: ${originalJobId}`);

            // Registrar métricas de fallo
            botExecutionCounter.inc({ bot_type: botType, status: 'failed' });
            botExecutionDuration.observe({ bot_type: botType }, executionTime);

            console.log(`📈 [WORKER-${botType.toUpperCase()}] Métricas actualizadas: failed++, duration: ${executionTime}s`);

            // Intentar enviar error al webhook manager si es posible
            try {
                const errorPayload = {
                    jobId: originalJobId,
                    result: {
                        success: false,
                        botType: botType.toUpperCase(),
                        error: error instanceof Error ? error.message : 'Unknown error',
                        timestamp: new Date().toISOString(),
                        executionNode: process.env.HOSTNAME || 'unknown',
                        executionTime: executionTime
                    },
                    webhookUrl
                };

                console.log(`📤 [WORKER-${botType.toUpperCase()}] Enviando notificación de error al webhook manager`);
                console.log(`🎯 [WORKER-${botType.toUpperCase()}] Error payload size: ${JSON.stringify(errorPayload).length} bytes`);

                await axios.post(`${WEBHOOK_MANAGER_URL}/deliver`, errorPayload, {
                    timeout: 5000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                console.log(`✅ [WORKER-${botType.toUpperCase()}] Notificación de error enviada exitosamente para job ${originalJobId}`);

            } catch (webhookError) {
                console.error(`❌ [WORKER-${botType.toUpperCase()}] Falló el envío de notificación de error al webhook manager:`, webhookError);
            }

            throw error;
        }
    }, {
        connection: redis,
        concurrency: botType === 'python' ? 5 : botType === 'node' ? 10 : 3, // Diferentes concurrencias
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 }
    });

    // Monitoreo de eventos del worker
    worker.on('completed', (job) => {
        console.log(`✅ [WORKER-${botType.toUpperCase()}] Job ${job.id} completado exitosamente`);
    });

    worker.on('failed', (job, err) => {
        console.error(`❌ [WORKER-${botType.toUpperCase()}] Job ${job?.id} falló:`, err.message);
    });

    worker.on('stalled', (jobId) => {
        console.warn(`⚠️ [WORKER-${botType.toUpperCase()}] Job ${jobId} se atoró (stalled)`);
    });

    worker.on('error', (err) => {
        console.error(`💥 [WORKER-${botType.toUpperCase()}] Error en worker:`, err);
    });

    worker.on('progress', (job, progress) => {
        console.log(`📊 [WORKER-${botType.toUpperCase()}] Job ${job.id} progreso: ${progress}%`);
    });

    console.log(`🚀 [WORKER-${botType.toUpperCase()}] Worker iniciado exitosamente con concurrencia: ${botType === 'python' ? 5 : botType === 'node' ? 10 : 3}`);
});

// Función para mostrar estadísticas de workers
async function logWorkerStats() {
    console.log('\n📊 Worker Statistics:');

    for (const botType of BOT_TYPES) {
        try {
            const queueName = `bot-${botType}-tasks`;
            // Aquí podrías obtener estadísticas específicas de cada cola
            console.log(`${botType.toUpperCase()}: Active workers processing tasks`);
        } catch (error) {
            console.error(`Error getting stats for ${botType}:`, error);
        }
    }
}

// Mostrar estadísticas cada 5 minutos
setInterval(logWorkerStats, 5 * 60 * 1000);

// Función para limpiar memoria y recursos
async function cleanup() {
    console.log('🧹 Running worker cleanup...');

    // Aquí podrías agregar lógica de limpieza específica
    if (global.gc) {
        global.gc();
        console.log('🗑️  Garbage collection executed');
    }
}

// Ejecutar limpieza cada 30 minutos
setInterval(cleanup, 30 * 60 * 1000);

// Graceful shutdown
async function shutdown() {
    console.log('🛑 Shutting down workers...');

    try {
        // Cerrar workers (se hace automáticamente con el proceso)
        await redis.quit();
        console.log('✅ Workers shutdown completed');
    } catch (error) {
        console.error('❌ Error during workers shutdown:', error);
    }

    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Configurar servidor HTTP para métricas
const app = express();
const PORT = process.env.WORKERS_PORT || 3003;

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'workers',
        botTypes: BOT_TYPES,
        hostname: process.env.HOSTNAME || 'unknown'
    });
});

// Métricas de Prometheus
app.get('/metrics', async (req: express.Request, res: express.Response) => {
    try {
        const metrics = await getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error) {
        console.error('Error getting metrics:', error);
        res.status(500).json({ error: 'Failed to get metrics' });
    }
});

// Iniciar servidor HTTP
app.listen(PORT, () => {
    console.log(`📊 Workers metrics server running on port ${PORT}`);
    serviceHealthGauge.set({ service: 'workers', version: '1.0.0' }, 1);
});

console.log('🚀 Multi-language bot workers started successfully');
console.log(`📍 Redis: ${REDIS_HOST}:6379`);
console.log(`🔗 Webhook Manager: ${WEBHOOK_MANAGER_URL}`);
console.log(`🤖 Bot types: ${BOT_TYPES.join(', ')}`);
console.log('🎯 Ready to process bot execution tasks...');

// Ejecutar estadísticas iniciales
logWorkerStats(); 