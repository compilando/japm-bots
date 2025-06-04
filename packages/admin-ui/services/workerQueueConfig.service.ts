import type { WorkerQueueConfig } from '@bot-core/common';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3001/api/v1';
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';

const getHeaders = () => {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (ADMIN_API_KEY) {
        headers['x-api-key'] = ADMIN_API_KEY;
    }
    return headers;
};

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const errorMessage = errorData.error || errorData.message || `Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }
    // Para respuestas 204 (No Content), no intentar parsear JSON.
    // Esta situación es más común para DELETEs, pero handleResponse es genérico.
    if (response.status === 204) {
        return Promise.resolve({} as T); // Corregido: Promise.resolveিয়াল a Promise.resolve
    }
    return response.json() as Promise<T>;
}

export const getAllWorkerQueueConfigs = async (): Promise<WorkerQueueConfig[]> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/worker-queues`, {
        method: 'GET',
        headers: getHeaders(),
    });
    return handleResponse<WorkerQueueConfig[]>(response);
};

export const getWorkerQueueConfig = async (queueName: string): Promise<WorkerQueueConfig> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/worker-queues/${encodeURIComponent(queueName)}`, {
        method: 'GET',
        headers: getHeaders(),
    });
    return handleResponse<WorkerQueueConfig>(response);
};

// Usamos un solo método para crear y actualizar, ya que la API POST maneja la lógica de "upsert".
export const saveWorkerQueueConfig = async (data: WorkerQueueConfig): Promise<WorkerQueueConfig> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/worker-queues`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<WorkerQueueConfig>(response);
};

export const deleteWorkerQueueConfig = async (queueName: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/worker-queues/${encodeURIComponent(queueName)}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const errorMessage = errorData.error || errorData.message || `Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }
    // No es necesario llamar a handleResponse aquí si no hay cuerpo que parsear en caso de éxito para una op void.
}; 