"use client";

import React, { useState } from 'react';
import { ClipboardDocumentIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// Plantilla para src/index.ts
const indexTsCode = `
// Worker Node.js/TypeScript para el sistema JAPM Bots
// ----------------------------------------------------

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const QUEUE_NAME = process.env.QUEUE_NAME || 'default-worker-queue';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const performTask = async (data: any) => {
  console.log(\`[\\\${QUEUE_NAME}] Iniciando tarea con datos:\\\`, data);
  const delay = Math.random() * 4000 + 1000;
  await new Promise(resolve => setTimeout(resolve, delay));
  const result = { success: true, message: "Tarea completada exitosamente", inputData: data };
  console.log(\`[\\\${QUEUE_NAME}] Tarea finalizada. Resultado:\\\`, result);
  return result;
};

const processor = async (job: Job) => {
  console.log(\`[\\\${QUEUE_NAME}] Job recibido con ID \\\${job.id}\\\`);\n  try {\n    const taskResult = await performTask(job.data);\n    return taskResult;\n  } catch (error) {\n    console.error(\`[\\\${QUEUE_NAME}] Error procesando job \\\${job.id}:\\\`, error);\n    throw error;\n  }\n};\n\nconst connection = new IORedis(REDIS_URL, {\n  maxRetriesPerRequest: null,\n});\n\nconnection.on('connect', () => console.log(\`[\\\${QUEUE_NAME}] Conectado a Redis\\\`));\nconnection.on('error', (err) => console.error(\`[\\\${QUEUE_NAME}] Error de conexión con Redis:\\\`, err));\n\nconst worker = new Worker(QUEUE_NAME, processor, {\n  connection,\n});\n\nconsole.log(\`[\\\${QUEUE_NAME}] Worker iniciado. Escuchando jobs en la cola '\\\${QUEUE_NAME}'...\\\`);\n\nworker.on('completed', (job, returnValue) => {\n  console.log(\`[\\\${QUEUE_NAME}] Job \\\${job.id} completado. Resultado:\\\`, returnValue);\n});\n\nworker.on('failed', (job, err) => {\n  console.error(\`[\\\${QUEUE_NAME}] Job \\\${job?.id || 'desconocido'} falló:\\\`, err.message);\n});\n\nworker.on('error', err => {\n  console.error(\`[\\\${QUEUE_NAME}] Error general en el worker:\\\`, err);\n});\n\nworker.on('active', job => {\n  console.log(\`[\\\${QUEUE_NAME}] Job \\\${job.id} ha comenzado a procesarse.\\\`);\n});\n\nworker.on('progress', (job, progress) => {\n  console.log(\`[\\\${QUEUE_NAME}] Job \\\${job.id} progreso: \\\${progress}%\\\`);\n});\n\nconst gracefulShutdown = async (signal: string) => {\n  console.log(\`[\\\${QUEUE_NAME}] Recibida señal \\\${signal}. Cerrando worker...\\\`);\n  try {\n    await worker.close();\n    console.log(\`[\\\${QUEUE_NAME}] Worker cerrado exitosamente.\\\`);\n  } catch (error) {\n    console.error(\`[\\\${QUEUE_NAME}] Error durante el cierre del worker:\\\`, error);\n  }\n  process.exit(0);\n};\n\nprocess.on('SIGINT', () => gracefulShutdown('SIGINT'));\nprocess.on('SIGTERM', () => gracefulShutdown('SIGTERM'));\n`;

// Plantilla para package.json (como objeto JS)
const packageJsonTemplate = {
    name: "my-japm-worker",
    version: "1.0.0",
    description: "Worker para JAPM Bot System",
    main: "dist/index.js",
    scripts: {
        build: "tsc",
        start: "node dist/index.js",
        dev: "ts-node src/index.ts",
        watch: "tsc -w"
    },
    keywords: ["japm", "bot", "worker"],
    author: "",
    license: "ISC",
    dependencies: {
        bullmq: "^5.7.0", // Ajusta la versión según tu proyecto
        dotenv: "^16.3.1",
        ioredis: "^5.3.2"  // Ajusta la versión según tu proyecto
    },
    devDependencies: {
        "@types/ioredis": "^5.0.0",
        "@types/node": "^20.11.0",
        "ts-node": "^10.9.2",
        typescript: "^5.3.3"
    }
};

// Plantilla para tsconfig.json (como objeto JS)
const tsConfigJsonTemplate = {
    compilerOptions: {
        target: "ES2020",
        module: "commonjs",
        rootDir: "./src",
        outDir: "./dist",
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "**/*.spec.ts"]
};

// Plantilla para .env.example
const envExampleTemplate = `
# URL de conexión a Redis
REDIS_URL=redis://localhost:6379

# Nombre de la cola que este worker procesará
# Asegúrate de que coincida con el 'workerTargetQueue' configurado en la Admin UI para los BotTypes
QUEUE_NAME=nombre-de-tu-cola-especifica
`;

// Combinar todas las plantillas en un solo string
const workerTemplateCode =
    `// --- INICIO: src/index.ts ---\n${indexTsCode}\n// --- FIN: src/index.ts ---\n\n\n// --- INICIO: package.json ---\n${JSON.stringify(packageJsonTemplate, null, 2)}\n// --- FIN: package.json ---\n\n\n// --- INICIO: tsconfig.json ---\n${JSON.stringify(tsConfigJsonTemplate, null, 2)}\n// --- FIN: tsconfig.json ---\n\n\n// --- INICIO: .env.example ---\n${envExampleTemplate}\n// --- FIN: .env.example ---\n`;

const WorkerTemplateGenerator: React.FC = () => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(workerTemplateCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Error al copiar el texto: ', err);
        }
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">
                    Plantilla de Worker (Node.js/TypeScript)
                </h1>
                <button
                    onClick={handleCopy}
                    className={`
            flex items-center px-4 py-2 rounded-lg transition-all duration-150 ease-in-out
            ${copied
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : 'bg-sky-500 hover:bg-sky-600 text-white focus:ring-2 focus:ring-sky-400 focus:ring-opacity-50'
                        }
            disabled:opacity-50
          `}
                    disabled={copied}
                >
                    {copied ? (
                        <CheckCircleIcon className="w-5 h-5 mr-2" />
                    ) : (
                        <ClipboardDocumentIcon className="w-5 h-5 mr-2" />
                    )}
                    {copied ? '¡Copiado!' : 'Copiar Plantilla'}
                </button>
            </div>

            <div className="bg-gray-900/70 backdrop-blur-md p-6 rounded-lg shadow-xl border border-gray-700 overflow-x-auto">
                <pre className="text-sm text-slate-200 whitespace-pre-wrap break-all">
                    <code>
                        {workerTemplateCode}
                    </code>
                </pre>
            </div>

            <div className="mt-6 p-4 bg-yellow-900/30 text-yellow-200 border border-yellow-700 rounded-lg text-sm">
                <h3 className="font-semibold mb-2">Instrucciones y Próximos Pasos:</h3>
                <p className="mb-2">Esta plantilla combinada te proporciona todos los archivos necesarios. Sigue estos pasos:</p>
                <ol className="list-decimal list-inside space-y-1">
                    <li>Crea un nuevo directorio para tu worker (ej. <code>my-awesome-worker</code>).</li>
                    <li>Copia toda la plantilla generada arriba.</li>
                    <li><strong>Divide el contenido copiado en los siguientes archivos dentro de tu nuevo directorio:</strong>
                        <ul className="list-disc list-inside pl-5 mt-1 space-y-1">
                            <li><code>src/index.ts</code> (con el código del worker).</li>
                            <li><code>package.json</code></li>
                            <li><code>tsconfig.json</code></li>
                            <li><code>.env.example</code> (renómbralo a <code>.env</code> y configura tus valores).</li>
                        </ul>
                    </li>
                    <li>Asegúrate de que la variable <code>QUEUE_NAME</code> en tu <code>.env</code> coincida con la <code>workerTargetQueue</code> configurada en la Admin UI.</li>
                    <li>En la terminal, dentro del directorio de tu worker, instala las dependencias: <code>npm install</code> (o <code>yarn install</code>).</li>
                    <li>Construye el worker: <code>npm run build</code> (si estás usando TypeScript compilado).</li>
                    <li>Ejecuta el worker: <code>npm run start</code> (o <code>npm run dev</code> para desarrollo con ts-node).</li>
                    <li>Implementa la lógica específica de tu bot dentro de la función <code>performTask</code> en <code>src/index.ts</code>.</li>
                </ol>
            </div>
        </div>
    );
};

export default WorkerTemplateGenerator; 