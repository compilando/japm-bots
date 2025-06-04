import express, { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { BotTypeConfig, BotGroup, BotExecutionRequest, WorkerQueueConfig } from '@bot-core/common';
import { ConfigService } from '../services/config.service';
import { ExecutionControlService } from '../services/execution-control.service'; // For potential future admin actions or internal use

// Define a simple authentication middleware (replace with your actual auth logic)
const authenticateAdmin = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    // THIS IS A PLACEHOLDER. IMPLEMENT PROPER AUTHENTICATION.
    // For example, check against a secure environment variable or a user database.
    if (apiKey === process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY) {
        next();
    } else {
        console.warn('[AdminRoutes] Failed authentication attempt.');
        res.status(401).json({ error: 'Unauthorized: Missing or invalid API key' });
    }
};

export const createAdminRoutes = (redisClient: Redis) => {
    const router = express.Router();
    const configService = new ConfigService(redisClient);
    // ExecutionControlService might be used for specific admin tasks later
    const executionControlService = new ExecutionControlService(redisClient, configService);

    // Secure all admin config routes with authentication middleware
    router.use('/config', authenticateAdmin);

    // --- BotTypeConfig Routes ---
    router.post('/config/bot-types', async (req: Request, res: Response) => {
        try {
            const config = req.body as BotTypeConfig;
            if (!config.botType || !config.runtimeType || !config.workerTargetQueue) {
                return res.status(400).json({ error: 'botType, runtimeType, and workerTargetQueue are required fields.' });
            }
            // Consider adding more specific validation for each field's format if necessary
            await configService.saveBotTypeConfig(config);
            res.status(201).json(config);
        } catch (error: any) {
            console.error('[AdminRoutes] Error saving bot type config:', error);
            res.status(500).json({ error: 'Failed to save bot type config', details: error.message });
        }
    });

    router.get('/config/bot-types', async (req: Request, res: Response) => {
        try {
            const configs = await configService.getAllBotTypeConfigs();
            res.status(200).json(configs);
        } catch (error: any) {
            console.error('[AdminRoutes] Error fetching all bot type configs:', error);
            res.status(500).json({ error: 'Failed to fetch bot type configs', details: error.message });
        }
    });

    router.get('/config/bot-types/:botType', async (req: Request, res: Response) => {
        try {
            const { botType } = req.params;
            const config = await configService.getBotTypeConfig(botType);
            if (config) {
                res.status(200).json(config);
            } else {
                res.status(404).json({ error: `Bot type config for '${botType}' not found.` });
            }
        } catch (error: any) {
            console.error(`[AdminRoutes] Error fetching bot type config for ${req.params.botType}:`, error);
            res.status(500).json({ error: 'Failed to fetch bot type config', details: error.message });
        }
    });

    router.put('/config/bot-types/:botType', async (req: Request, res: Response) => {
        try {
            const { botType } = req.params;
            const updates = req.body as Partial<BotTypeConfig>;
            // Prevent changing the botType via PUT on this route
            if (updates.botType && updates.botType !== botType) {
                return res.status(400).json({ error: 'Cannot change botType via this route. Use POST to create a new one or ensure botType in body matches path.' });
            }
            const updatedConfig = await configService.updateBotTypeConfig(botType, updates);
            if (updatedConfig) {
                res.status(200).json(updatedConfig);
            } else {
                res.status(404).json({ error: `Bot type config for '${botType}' not found for update.` });
            }
        } catch (error: any) {
            console.error(`[AdminRoutes] Error updating bot type config for ${req.params.botType}:`, error);
            res.status(500).json({ error: 'Failed to update bot type config', details: error.message });
        }
    });

    router.delete('/config/bot-types/:botType', async (req: Request, res: Response) => {
        try {
            const { botType } = req.params;
            // Consider adding checks: e.g., prevent deletion if botType is in use by any BotGroup.
            await configService.deleteBotTypeConfig(botType);
            res.status(204).send();
        } catch (error: any) {
            console.error(`[AdminRoutes] Error deleting bot type config for ${req.params.botType}:`, error);
            res.status(500).json({ error: 'Failed to delete bot type config', details: error.message });
        }
    });

    // --- BotGroup Routes ---
    router.post('/config/bot-groups', async (req: Request, res: Response) => {
        try {
            const group = req.body as BotGroup;
            if (!group.groupId || !group.name || !group.botTypes || !group.executionRule) {
                return res.status(400).json({ error: 'groupId, name, botTypes, and executionRule are required fields for a group.' });
            }
            // Add deeper validation for executionRule structure and ensure botTypes exist
            await configService.saveBotGroup(group);
            res.status(201).json(group);
        } catch (error: any) {
            console.error('[AdminRoutes] Error saving bot group config:', error);
            res.status(500).json({ error: 'Failed to save bot group config', details: error.message });
        }
    });

    router.get('/config/bot-groups', async (req: Request, res: Response) => {
        try {
            const groups = await configService.getAllBotGroups();
            res.status(200).json(groups);
        } catch (error: any) {
            console.error('[AdminRoutes] Error fetching all bot group configs:', error);
            res.status(500).json({ error: 'Failed to fetch bot group configs', details: error.message });
        }
    });

    router.get('/config/bot-groups/:groupId', async (req: Request, res: Response) => {
        try {
            const { groupId } = req.params;
            const group = await configService.getBotGroup(groupId);
            if (group) {
                res.status(200).json(group);
            } else {
                res.status(404).json({ error: `Bot group config for '${groupId}' not found.` });
            }
        } catch (error: any) {
            console.error(`[AdminRoutes] Error fetching bot group config for ${req.params.groupId}:`, error);
            res.status(500).json({ error: 'Failed to fetch bot group config', details: error.message });
        }
    });

    router.put('/config/bot-groups/:groupId', async (req: Request, res: Response) => {
        try {
            const { groupId } = req.params;
            const updates = req.body as Partial<BotGroup>;
            if (updates.groupId && updates.groupId !== groupId) {
                return res.status(400).json({ error: 'Cannot change groupId via this route.' });
            }
            const updatedGroup = await configService.updateBotGroup(groupId, updates);
            if (updatedGroup) {
                res.status(200).json(updatedGroup);
            } else {
                res.status(404).json({ error: `Bot group config for '${groupId}' not found for update.` });
            }
        } catch (error: any) {
            console.error(`[AdminRoutes] Error updating bot group config for ${req.params.groupId}:`, error);
            res.status(500).json({ error: 'Failed to update bot group config', details: error.message });
        }
    });

    router.delete('/config/bot-groups/:groupId', async (req: Request, res: Response) => {
        try {
            const { groupId } = req.params;
            await configService.deleteBotGroup(groupId);
            res.status(204).send();
        } catch (error: any) {
            console.error(`[AdminRoutes] Error deleting bot group config for ${req.params.groupId}:`, error);
            res.status(500).json({ error: 'Failed to delete bot group config', details: error.message });
        }
    });

    // --- WorkerQueueConfig Routes ---
    router.post('/config/worker-queues', async (req: Request, res: Response) => {
        try {
            const config = req.body as WorkerQueueConfig;
            if (!config.queueName || typeof config.queueName !== 'string') {
                return res.status(400).json({ error: 'queueName is a required string field.' });
            }
            if (config.maxConcurrency !== undefined && (typeof config.maxConcurrency !== 'number' || config.maxConcurrency < 0)) {
                return res.status(400).json({ error: 'maxConcurrency must be a non-negative number if provided.' });
            }
            if (config.timeoutMs !== undefined && (typeof config.timeoutMs !== 'number' || config.timeoutMs < 0)) {
                return res.status(400).json({ error: 'timeoutMs must be a non-negative number if provided.' });
            }

            await configService.saveWorkerQueueConfig(config);
            res.status(201).json(config);
        } catch (error: any) {
            console.error('[AdminRoutes] Error saving worker queue config:', error);
            res.status(500).json({ error: 'Failed to save worker queue config', details: error.message });
        }
    });

    router.get('/config/worker-queues', async (req: Request, res: Response) => {
        try {
            const configs = await configService.getAllWorkerQueueConfigs();
            res.status(200).json(configs);
        } catch (error: any) {
            console.error('[AdminRoutes] Error fetching all worker queue configs:', error);
            res.status(500).json({ error: 'Failed to fetch worker queue configs', details: error.message });
        }
    });

    router.get('/config/worker-queues/:queueName', async (req: Request, res: Response) => {
        try {
            const { queueName } = req.params;
            const config = await configService.getWorkerQueueConfig(queueName);
            if (config) {
                res.status(200).json(config);
            } else {
                res.status(404).json({ error: `Worker queue config for '${queueName}' not found.` });
            }
        } catch (error: any) {
            console.error(`[AdminRoutes] Error fetching worker queue config for ${req.params.queueName}:`, error);
            res.status(500).json({ error: 'Failed to fetch worker queue config', details: error.message });
        }
    });

    router.delete('/config/worker-queues/:queueName', async (req: Request, res: Response) => {
        try {
            const { queueName } = req.params;
            await configService.deleteWorkerQueueConfig(queueName);
            res.status(204).send(); // Successfully deleted, no content to return
        } catch (error: any) {
            console.error(`[AdminRoutes] Error deleting worker queue config for ${req.params.queueName}:`, error);
            res.status(500).json({ error: 'Failed to delete worker queue config', details: error.message });
        }
    });

    // --- Internal Admin Routes (Not directly for user config, might need different/no auth or service-level auth) ---
    // This endpoint is intended to be called by the Orchestrator or another internal service.
    // Consider if a more specific authentication/authorization is needed here (e.g. internal service token)
    router.post('/internal/release-concurrency/:botType', async (req: Request, res: Response) => {
        try {
            const { botType } = req.params;
            if (!botType) {
                return res.status(400).json({ error: 'botType path parameter is required.' });
            }
            console.log(`[AdminRoutes-Internal] Received request to release concurrency for ${botType}`);
            await executionControlService.releaseConcurrencySlot(botType);
            res.status(200).json({ message: `Concurrency slot release signal processed for ${botType}.` });
        } catch (error: any) {
            console.error(`[AdminRoutes-Internal] Error releasing concurrency for ${req.params.botType}:`, error);
            res.status(500).json({ error: 'Failed to release concurrency slot', details: error.message });
        }
    });

    return router;
}; 