import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env.MOCK_WEBHOOK_PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Almacenar webhooks recibidos en memoria
const receivedWebhooks: any[] = [];

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        totalWebhooksReceived: receivedWebhooks.length
    });
});

// Endpoint principal para recibir webhooks
app.post('/', (req, res) => {
    const webhook = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        headers: req.headers,
        body: req.body,
        method: req.method,
        url: req.url
    };

    receivedWebhooks.push(webhook);

    console.log(`📥 Webhook received: ${webhook.id}`);
    console.log(`📊 Bot Type: ${req.body?.botType || 'unknown'}`);
    console.log(`✅ Success: ${req.body?.success || 'unknown'}`);
    console.log(`📝 Data:`, JSON.stringify(req.body?.data, null, 2));

    // Simular ocasionalmente errores para testing de reintentos
    const shouldFail = Math.random() < 0.1; // 10% probabilidad de fallo

    if (shouldFail) {
        console.log(`❌ Simulating webhook failure for testing`);
        return res.status(500).json({
            error: 'Simulated webhook failure',
            timestamp: new Date().toISOString()
        });
    }

    // Respuesta exitosa
    res.status(200).json({
        message: 'Webhook received successfully',
        webhookId: webhook.id,
        timestamp: webhook.timestamp,
        processed: true
    });
});

// Endpoint para obtener todos los webhooks recibidos
app.get('/webhooks', (req, res) => {
    const { limit = 50, offset = 0 } = req.query;

    const paginatedWebhooks = receivedWebhooks
        .slice(Number(offset), Number(offset) + Number(limit))
        .reverse(); // Más recientes primero

    res.json({
        webhooks: paginatedWebhooks,
        total: receivedWebhooks.length,
        limit: Number(limit),
        offset: Number(offset)
    });
});

// Endpoint para obtener un webhook específico
app.get('/webhooks/:id', (req, res) => {
    const { id } = req.params;
    const webhook = receivedWebhooks.find(w => w.id === id);

    if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json(webhook);
});

// Endpoint para limpiar webhooks
app.delete('/webhooks', (req, res) => {
    const count = receivedWebhooks.length;
    receivedWebhooks.length = 0;

    console.log(`🧹 Cleared ${count} webhooks`);

    res.json({
        message: `Cleared ${count} webhooks`,
        timestamp: new Date().toISOString()
    });
});

// Endpoint para estadísticas
app.get('/stats', (req, res) => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentWebhooks = receivedWebhooks.filter(w =>
        new Date(w.timestamp) > oneHourAgo
    );

    const dailyWebhooks = receivedWebhooks.filter(w =>
        new Date(w.timestamp) > oneDayAgo
    );

    const successfulWebhooks = receivedWebhooks.filter(w =>
        w.body?.success === true
    );

    const failedWebhooks = receivedWebhooks.filter(w =>
        w.body?.success === false
    );

    // Estadísticas por tipo de bot
    const botTypeStats = receivedWebhooks.reduce((acc, webhook) => {
        const botType = webhook.body?.botType || 'unknown';
        acc[botType] = (acc[botType] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    res.json({
        total: receivedWebhooks.length,
        lastHour: recentWebhooks.length,
        lastDay: dailyWebhooks.length,
        successful: successfulWebhooks.length,
        failed: failedWebhooks.length,
        botTypeStats,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Endpoint para simular diferentes respuestas
app.post('/test/:responseType', (req, res) => {
    const { responseType } = req.params;

    console.log(`🧪 Test endpoint called: ${responseType}`);

    switch (responseType) {
        case 'success':
            res.status(200).json({ message: 'Test success response' });
            break;
        case 'error':
            res.status(500).json({ error: 'Test error response' });
            break;
        case 'timeout':
            // No responder para simular timeout
            setTimeout(() => {
                res.status(200).json({ message: 'Delayed response' });
            }, 35000); // 35 segundos
            break;
        case 'not-found':
            res.status(404).json({ error: 'Test not found response' });
            break;
        default:
            res.status(400).json({ error: 'Invalid test type' });
    }
});

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
    console.log(`🚀 Mock Webhook Server running on port ${PORT}`);
    console.log(`📥 Ready to receive webhooks at http://localhost:${PORT}/`);
    console.log(`📊 Stats available at http://localhost:${PORT}/stats`);
    console.log(`📋 Webhooks list at http://localhost:${PORT}/webhooks`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down Mock Webhook Server...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Shutting down Mock Webhook Server...');
    process.exit(0);
});

console.log('🚀 Mock Webhook Server started successfully');
console.log('🎯 Ready to receive and log webhook deliveries...'); 