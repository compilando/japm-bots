import type { BotGroup } from '@bot-core/common';

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
    if (response.status === 204) { // No Content for DELETE, or potentially other successful no-body responses
        return Promise.resolve({} as T); // Resolve with an empty object cast to T, or adjust as needed
    }
    return response.json() as Promise<T>;
}

export const getAllBotGroups = async (): Promise<BotGroup[]> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/bot-groups`, {
        method: 'GET',
        headers: getHeaders(),
    });
    return handleResponse<BotGroup[]>(response);
};

export const getBotGroupById = async (groupId: string): Promise<BotGroup> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/bot-groups/${encodeURIComponent(groupId)}`, {
        method: 'GET',
        headers: getHeaders(),
    });
    return handleResponse<BotGroup>(response);
};

export const createBotGroup = async (data: BotGroup): Promise<BotGroup> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/bot-groups`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<BotGroup>(response);
};

export const updateBotGroup = async (groupId: string, data: Partial<Omit<BotGroup, 'groupId'>>): Promise<BotGroup> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/bot-groups/${encodeURIComponent(groupId)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<BotGroup>(response);
};

export const deleteBotGroup = async (groupId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/admin/config/bot-groups/${encodeURIComponent(groupId)}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const errorMessage = errorData.error || errorData.message || `Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }
}; 