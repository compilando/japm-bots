import swaggerJSDoc from 'swagger-jsdoc';
import { Request, Response } from 'express';

/**
 * Configuración de Swagger para el Webhook Manager
 */
const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: '📤 Bot System - Webhook Manager',
        version: '1.0.0',
        description: `
## Gestor de Webhooks con Reintentos Inteligentes

El **Webhook Manager** es el servicio encargado de entregar los resultados de los bots ejecutados 
a través de webhooks HTTP con un sistema robusto de reintentos y manejo de errores.

### Características principales:
- 📤 **Entrega confiable** de webhooks con reintentos automáticos
- ⚡ **Backoff exponencial** para evitar sobrecarga en servicios
- 📊 **Métricas detalladas** de entregas exitosas y fallidas
- 🔄 **Queue-based processing** con BullMQ para alta disponibilidad
- 📈 **Monitoreo en tiempo real** del estado de entregas
- 🛡️ **Manejo inteligente** de errores temporales vs permanentes

### Flujo de trabajo:
1. Recibe resultados de bots desde los workers
2. Encola la entrega del webhook con configuración de reintentos
3. Procesa entregas de forma asíncrona
4. Reintenta automáticamente en caso de fallos temporales
5. Reporta métricas y estado de entregas
        `,
        contact: {
            name: 'Bot System Team',
            email: 'support@botsystem.com'
        },
        license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
        }
    },
    servers: [
        {
            url: 'http://localhost:4000',
            description: 'Servidor de desarrollo'
        },
        {
            url: 'https://webhooks.botsystem.com',
            description: 'Servidor de producción'
        }
    ],
    tags: [
        {
            name: 'Webhooks',
            description: 'Operaciones de entrega de webhooks'
        },
        {
            name: 'Deliveries',
            description: 'Consulta de estado de entregas'
        },
        {
            name: 'Stats',
            description: 'Estadísticas de entregas'
        },
        {
            name: 'Health',
            description: 'Endpoints de salud y monitoreo'
        }
    ],
    components: {
        schemas: {
            WebhookDeliveryRequest: {
                type: 'object',
                required: ['jobId', 'result', 'webhookUrl'],
                properties: {
                    jobId: {
                        type: 'string',
                        description: 'ID único del trabajo que generó el resultado',
                        example: '12345'
                    },
                    result: {
                        type: 'object',
                        description: 'Resultado del bot a entregar',
                        example: {
                            status: 'success',
                            output: {
                                processedData: [1, 2, 3, 4, 5],
                                summary: 'Análisis completado exitosamente',
                                executionTime: 4500
                            },
                            botType: 'python',
                            timestamp: '2024-01-15T10:35:00Z'
                        }
                    },
                    webhookUrl: {
                        type: 'string',
                        format: 'uri',
                        description: 'URL destino para la entrega del webhook',
                        example: 'https://myapp.com/webhook/bot-result'
                    }
                }
            },
            WebhookDeliveryResponse: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        enum: ['queued'],
                        example: 'queued'
                    },
                    deliveryId: {
                        type: 'string',
                        description: 'ID único de la entrega encolada',
                        example: '67890'
                    },
                    webhookUrl: {
                        type: 'string',
                        format: 'uri',
                        example: 'https://myapp.com/webhook/bot-result'
                    },
                    maxRetries: {
                        type: 'integer',
                        description: 'Número máximo de reintentos configurado',
                        example: 5
                    }
                }
            },
            DeliveryStatus: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'ID de la entrega',
                        example: '67890'
                    },
                    state: {
                        type: 'string',
                        enum: ['waiting', 'active', 'completed', 'failed'],
                        description: 'Estado actual de la entrega',
                        example: 'completed'
                    },
                    data: {
                        type: 'object',
                        description: 'Datos de la entrega (jobId, result, webhookUrl)'
                    },
                    attemptsMade: {
                        type: 'integer',
                        description: 'Número de intentos realizados',
                        example: 1
                    },
                    createdAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Fecha de creación de la entrega',
                        example: '2024-01-15T10:35:00Z'
                    },
                    processedOn: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                        description: 'Fecha de inicio del procesamiento',
                        example: '2024-01-15T10:35:05Z'
                    },
                    finishedOn: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                        description: 'Fecha de finalización',
                        example: '2024-01-15T10:35:07Z'
                    },
                    failedReason: {
                        type: 'string',
                        nullable: true,
                        description: 'Razón del fallo si aplica',
                        example: null
                    }
                }
            },
            WebhookStats: {
                type: 'object',
                properties: {
                    webhookDeliveries: {
                        type: 'object',
                        properties: {
                            waiting: {
                                type: 'integer',
                                description: 'Entregas esperando procesamiento',
                                example: 2
                            },
                            active: {
                                type: 'integer',
                                description: 'Entregas en proceso',
                                example: 1
                            },
                            completed: {
                                type: 'integer',
                                description: 'Entregas completadas exitosamente',
                                example: 245
                            },
                            failed: {
                                type: 'integer',
                                description: 'Entregas fallidas definitivamente',
                                example: 7
                            }
                        }
                    }
                }
            },
            HealthResponse: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        enum: ['healthy'],
                        example: 'healthy'
                    },
                    timestamp: {
                        type: 'string',
                        format: 'date-time',
                        example: '2024-01-15T10:30:00Z'
                    },
                    queue: {
                        type: 'string',
                        description: 'Nombre de la cola activa',
                        example: 'webhook-deliveries'
                    }
                }
            },
            Error: {
                type: 'object',
                properties: {
                    error: {
                        type: 'string',
                        description: 'Mensaje de error',
                        example: 'webhookUrl debe ser una URL válida'
                    },
                    timestamp: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Timestamp del error',
                        example: '2024-01-15T10:30:00Z'
                    }
                }
            }
        },
        responses: {
            BadRequest: {
                description: 'Solicitud inválida',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Error'
                        }
                    }
                }
            },
            NotFound: {
                description: 'Entrega no encontrada',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Error'
                        }
                    }
                }
            },
            InternalServerError: {
                description: 'Error interno del servidor',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Error'
                        }
                    }
                }
            }
        },
        examples: {
            PythonBotResult: {
                summary: 'Resultado de bot Python',
                value: {
                    jobId: 'py_12345',
                    result: {
                        status: 'success',
                        output: {
                            analysis: {
                                mean: 45.6,
                                median: 42.0,
                                std_dev: 12.3
                            },
                            recommendations: [
                                'Incrementar muestra en región norte',
                                'Revisar datos atípicos en enero'
                            ],
                            charts: [
                                {
                                    type: 'histogram',
                                    url: 'https://storage.example.com/chart1.png'
                                }
                            ]
                        },
                        executionTime: 4500,
                        botType: 'python'
                    },
                    webhookUrl: 'https://myapp.com/python-results'
                }
            },
            NodeBotResult: {
                summary: 'Resultado de bot Node.js',
                value: {
                    jobId: 'node_67890',
                    result: {
                        status: 'success',
                        output: {
                            apiResponses: [
                                {
                                    endpoint: '/users',
                                    status: 200,
                                    responseTime: 245,
                                    data: { users: 1250 }
                                }
                            ],
                            summary: 'API testing completado',
                            errors: []
                        },
                        executionTime: 2100,
                        botType: 'node'
                    },
                    webhookUrl: 'https://myapp.com/node-results'
                }
            },
            JavaBotResult: {
                summary: 'Resultado de bot Java',
                value: {
                    jobId: 'java_11111',
                    result: {
                        status: 'success',
                        output: {
                            processedRecords: 50000,
                            batchResults: [
                                {
                                    batchId: 1,
                                    recordsProcessed: 10000,
                                    successRate: 99.8
                                }
                            ],
                            totalProcessingTime: 45000,
                            memoryUsage: '2.1GB'
                        },
                        executionTime: 45000,
                        botType: 'java'
                    },
                    webhookUrl: 'https://myapp.com/java-results'
                }
            }
        }
    }
};

const options = {
    definition: swaggerDefinition,
    apis: ['./src/index.ts'], // Archivos que contienen anotaciones de Swagger
};

export const swaggerSpec = swaggerJSDoc(options);

/**
 * Endpoint para servir el spec de Swagger en formato JSON
 */
export const swaggerJson = (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
}; 