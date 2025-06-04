import type { BotTypeConfig } from '@bot-core/common'; // Assuming @bot-core/common is accessible

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3001/api/v1'; // Default if not set, update port/path as needed
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';

const getHeaders = () => {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (ADMIN_API_KEY) {
        headers['x-api-key'] = ADMIN_API_KEY; // Corregido: usar 'x-api-key' en minúsculas
    }
    return headers;
};

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

export const getBotTypes = async (): Promise<BotTypeConfig[]> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/bot-types`, {
        method: 'GET',
        headers: getHeaders(),
    });
    return handleResponse<BotTypeConfig[]>(response);
};

export const getBotType = async (botTypeId: string): Promise<BotTypeConfig> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/bot-types/${botTypeId}`, {
        method: 'GET',
        headers: getHeaders(),
    });
    return handleResponse<BotTypeConfig>(response);
};

export const createBotType = async (data: Omit<BotTypeConfig, 'botType'> & { botType: string }): Promise<BotTypeConfig> => {
    // Ensure botType is part of the main object, not just in path for creation
    const response = await fetch(`${API_BASE_URL}/admin/config/bot-types`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<BotTypeConfig>(response);
};

export const updateBotType = async (botTypeId: string, data: Partial<Omit<BotTypeConfig, 'botType'>>): Promise<BotTypeConfig> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/bot-types/${botTypeId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<BotTypeConfig>(response);
};

export const deleteBotType = async (botTypeId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/bot-types/${botTypeId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    // DELETE might return 204 No Content, so no JSON body to parse
}; 