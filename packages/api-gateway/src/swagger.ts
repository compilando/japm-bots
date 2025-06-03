import swaggerJSDoc from 'swagger-jsdoc';
import { Request, Response } from 'express';

/**
 * Configuración de Swagger para el API Gateway
 */
const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: '🤖 Bot System - API Gateway',
        version: '1.0.0',
        description: `
## Sistema de Ejecución Distribuida de Bots

El **API Gateway** es el punto de entrada principal para invocar bots de diferentes tipos (Python, Node.js, Java) 
de forma asíncrona con control de concurrencia y manejo inteligente de colas.

### Características principales:
- 🚀 **Ejecución asíncrona** de bots especializados
- 🎯 **Control de concurrencia** mediante semáforos distribuidos  
- 📊 **Monitoreo en tiempo real** con métricas de Prometheus
- 🔄 **Sistema de reintentos** con backoff exponencial
- 📱 **Webhooks de notificación** para resultados
- 📈 **Rate limiting** y seguridad avanzada

### Tipos de bots soportados:
- **Python**: Para análisis de datos y ML
- **Node.js**: Para APIs y procesamiento web
- **Java**: Para procesamientos batch y empresariales
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
            url: 'http://localhost:3000',
            description: 'Servidor de desarrollo'
        },
        {
            url: 'https://api.botsystem.com',
            description: 'Servidor de producción'
        }
    ],
    tags: [
        {
            name: 'Bots',
            description: 'Operaciones relacionadas con la ejecución de bots'
        },
        {
            name: 'Jobs',
            description: 'Consulta de estado y progreso de trabajos'
        },
        {
            name: 'Stats',
            description: 'Estadísticas y métricas del sistema'
        },
        {
            name: 'Health',
            description: 'Endpoints de salud y monitoreo'
        },
        {
            name: 'Admin',
            description: 'Herramientas de administración'
        }
    ],
    components: {
        schemas: {
            BotInvokeRequest: {
                type: 'object',
                required: ['botType', 'payload', 'webhookUrl'],
                properties: {
                    botType: {
                        type: 'string',
                        enum: ['python', 'node', 'java'],
                        description: 'Tipo de bot a ejecutar',
                        example: 'python'
                    },
                    payload: {
                        type: 'object',
                        description: 'Datos específicos para el bot',
                        example: {
                            task: 'data_analysis',
                            dataset: 'sales_2024',
                            parameters: {
                                algorithm: 'regression',
                                features: ['price', 'quantity', 'date']
                            }
                        }
                    },
                    webhookUrl: {
                        type: 'string',
                        format: 'uri',
                        description: 'URL donde se enviará el resultado',
                        example: 'https://myapp.com/webhook/bot-result'
                    },
                    priority: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 10,
                        default: 3,
                        description: 'Prioridad del trabajo (1=alta, 10=baja)',
                        example: 2
                    }
                }
            },
            BotInvokeResponse: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        enum: ['enqueued'],
                        example: 'enqueued'
                    },
                    jobId: {
                        type: 'string',
                        description: 'ID único del trabajo encolado',
                        example: '12345'
                    },
                    botType: {
                        type: 'string',
                        enum: ['python', 'node', 'java'],
                        example: 'python'
                    },
                    priority: {
                        type: 'integer',
                        example: 2
                    },
                    estimatedPosition: {
                        type: 'integer',
                        description: 'Posición estimada en la cola',
                        example: 3
                    }
                }
            },
            JobStatus: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'ID del trabajo',
                        example: '12345'
                    },
                    state: {
                        type: 'string',
                        enum: ['waiting', 'active', 'completed', 'failed'],
                        description: 'Estado actual del trabajo',
                        example: 'completed'
                    },
                    data: {
                        type: 'object',
                        description: 'Datos del trabajo'
                    },
                    progress: {
                        type: 'integer',
                        minimum: 0,
                        maximum: 100,
                        description: 'Progreso del trabajo en porcentaje',
                        example: 100
                    },
                    createdAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Fecha de creación',
                        example: '2024-01-15T10:30:00Z'
                    },
                    processedOn: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                        description: 'Fecha de inicio de procesamiento',
                        example: '2024-01-15T10:31:00Z'
                    },
                    finishedOn: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                        description: 'Fecha de finalización',
                        example: '2024-01-15T10:35:00Z'
                    },
                    failedReason: {
                        type: 'string',
                        nullable: true,
                        description: 'Razón del fallo si aplica',
                        example: null
                    }
                }
            },
            QueueStats: {
                type: 'object',
                properties: {
                    botQueue: {
                        type: 'object',
                        properties: {
                            waiting: {
                                type: 'integer',
                                description: 'Trabajos esperando',
                                example: 5
                            },
                            active: {
                                type: 'integer',
                                description: 'Trabajos en proceso',
                                example: 2
                            },
                            completed: {
                                type: 'integer',
                                description: 'Trabajos completados',
                                example: 127
                            },
                            failed: {
                                type: 'integer',
                                description: 'Trabajos fallidos',
                                example: 3
                            }
                        }
                    },
                    webhookQueue: {
                        type: 'object',
                        properties: {
                            waiting: {
                                type: 'integer',
                                description: 'Webhooks esperando',
                                example: 1
                            },
                            active: {
                                type: 'integer',
                                description: 'Webhooks enviándose',
                                example: 0
                            },
                            completed: {
                                type: 'integer',
                                description: 'Webhooks entregados',
                                example: 124
                            },
                            failed: {
                                type: 'integer',
                                description: 'Webhooks fallidos',
                                example: 2
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
                    queues: {
                        type: 'object',
                        properties: {
                            'bot-tasks': {
                                type: 'string',
                                example: 'bot-tasks'
                            },
                            'webhook-deliveries': {
                                type: 'string',
                                example: 'webhook-deliveries'
                            }
                        }
                    }
                }
            },
            Error: {
                type: 'object',
                properties: {
                    error: {
                        type: 'string',
                        description: 'Mensaje de error',
                        example: 'Tipo de bot inválido'
                    },
                    details: {
                        type: 'object',
                        description: 'Detalles adicionales del error (solo en desarrollo)'
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
                description: 'Recurso no encontrado',
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
            },
            TooManyRequests: {
                description: 'Demasiadas solicitudes',
                content: {
                    'text/plain': {
                        schema: {
                            type: 'string',
                            example: 'Too many requests from this IP'
                        }
                    }
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