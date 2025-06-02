import { Worker } from 'bullmq';
import Redis from 'ioredis';
import axios from 'axios';
import {
    botExecutionCounter,
    botExecutionDuration
} from '@bot-core/common';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const WEBHOOK_MANAGER_URL = process.env.WEBHOOK_MANAGER_URL || 'http://webhook-manager:4000';
const BOT_TYPES = ['python', 'node', 'java'];

// Configurar Redis
const redis = new Redis({
    host: REDIS_HOST,
    port: 6379,
    maxRetriesPerRequest: 3
});

// Simuladores de ejecución por tipo de bot
const botSimulators = {
    python: async (payload: any) => {
        const executionTime = 2000 + Math.random() * 3000; // 2-5 segundos
        await new Promise(resolve => setTimeout(resolve, executionTime));

        return {
            language: 'Python',
            version: '3.11.0',
            result: `Processed ${JSON.stringify(payload)} with Python`,
            executionTime: executionTime,
            libraries: ['numpy', 'pandas', 'requests'],
            output: `Python bot execution completed successfully\nInput: ${JSON.stringify(payload)}\nProcessed at: ${new Date().toISOString()}`
        };
    },

    node: async (payload: any) => {
        const executionTime = 1000 + Math.random() * 2000; // 1-3 segundos
        await new Promise(resolve => setTimeout(resolve, executionTime));

        return {
            language: 'Node.js',
            version: '18.19.0',
            result: `Processed ${JSON.stringify(payload)} with Node.js`,
            executionTime: executionTime,
            modules: ['axios', 'lodash', 'moment'],
            output: `Node.js bot execution completed successfully\nInput: ${JSON.stringify(payload)}\nProcessed at: ${new Date().toISOString()}`
        };
    },

    java: async (payload: any) => {
        const executionTime = 3000 + Math.random() * 4000; // 3-7 segundos
        await new Promise(resolve => setTimeout(resolve, executionTime));

        return {
            language: 'Java',
            version: '17.0.0',
            result: `Processed ${JSON.stringify(payload)} with Java`,
            executionTime: executionTime,
            libraries: ['Spring Boot', 'Apache Commons', 'Jackson'],
            output: `Java bot execution completed successfully\nInput: ${JSON.stringify(payload)}\nProcessed at: ${new Date().toISOString()}`
        };
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
            console.log(`🤖 Executing ${botType.toUpperCase()} bot - Job ID: ${job.id}`);

            const { originalJobId, payload, webhookUrl, semaphoreIdentifier } = job.data;

            // Simular error ocasional
            if (shouldSimulateError()) {
                throw new Error(`Simulated ${botType} bot execution error`);
            }

            // Actualizar progreso
            job.updateProgress(25);

            // Ejecutar simulador específico del bot
            const simulator = botSimulators[botType as keyof typeof botSimulators];
            if (!simulator) {
                throw new Error(`No simulator found for bot type: ${botType}`);
            }

            job.updateProgress(50);

            // Ejecutar bot
            const result = await simulator(payload);

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

            console.log(`📤 Sending result to webhook manager for job ${originalJobId}`);

            await axios.post(`${WEBHOOK_MANAGER_URL}/deliver`, webhookPayload, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            job.updateProgress(100);

            // Registrar métricas exitosas
            const executionTime = (Date.now() - startTime) / 1000;
            botExecutionDuration.observe({ bot_type: botType }, executionTime);
            botExecutionCounter.inc({ bot_type: botType, status: 'completed' });

            console.log(`✅ ${botType.toUpperCase()} bot completed successfully in ${executionTime}s`);

            return {
                success: true,
                botType,
                executionTime,
                webhookDelivered: true
            };

        } catch (error) {
            const executionTime = (Date.now() - startTime) / 1000;

            console.error(`❌ ${botType.toUpperCase()} bot failed:`, error);

            // Registrar métricas de fallo
            botExecutionCounter.inc({ bot_type: botType, status: 'failed' });
            botExecutionDuration.observe({ bot_type: botType }, executionTime);

            // Intentar enviar error al webhook manager si es posible
            try {
                const { originalJobId, webhookUrl } = job.data;

                const errorPayload = {
                    jobId: originalJobId,
                    result: {
                        success: false,
                        botType: botType.toUpperCase(),
                        error: error instanceof Error ? error.message : 'Unknown error',
                        timestamp: new Date().toISOString(),
                        executionNode: process.env.HOSTNAME || 'unknown'
                    },
                    webhookUrl
                };

                await axios.post(`${WEBHOOK_MANAGER_URL}/deliver`, errorPayload, {
                    timeout: 5000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                console.log(`📤 Error notification sent to webhook manager for job ${originalJobId}`);

            } catch (webhookError) {
                console.error(`❌ Failed to send error notification to webhook manager:`, webhookError);
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
        console.log(`✅ ${botType.toUpperCase()} job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
        console.error(`❌ ${botType.toUpperCase()} job ${job?.id} failed:`, err.message);
    });

    worker.on('stalled', (jobId) => {
        console.warn(`⚠️  ${botType.toUpperCase()} job ${jobId} stalled`);
    });

    worker.on('progress', (job, progress) => {
        console.log(`📊 ${botType.toUpperCase()} job ${job.id} progress: ${progress}%`);
    });

    console.log(`🚀 ${botType.toUpperCase()} worker started (concurrency: ${worker.opts.concurrency})`);
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

console.log('🚀 Multi-language bot workers started successfully');
console.log(`📍 Redis: ${REDIS_HOST}:6379`);
console.log(`🔗 Webhook Manager: ${WEBHOOK_MANAGER_URL}`);
console.log(`🤖 Bot types: ${BOT_TYPES.join(', ')}`);
console.log('🎯 Ready to process bot execution tasks...');

// Ejecutar estadísticas iniciales
logWorkerStats(); 