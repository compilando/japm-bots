'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { WorkerQueueConfig } from '@bot-core/common';
import {
    getAllWorkerQueueConfigs,
    saveWorkerQueueConfig as apiSaveWorkerQueueConfig,
    deleteWorkerQueueConfig as apiDeleteWorkerQueueConfig,
} from '@/services/workerQueueConfig.service';

interface WorkerQueueConfigContextType {
    configs: WorkerQueueConfig[];
    loading: boolean;
    error: Error | null;
    fetchConfigs: () => Promise<void>;
    saveConfig: (config: WorkerQueueConfig) => Promise<void>; // Handles both create and update
    removeConfig: (queueName: string) => Promise<void>;
}

const WorkerQueueConfigContext = createContext<WorkerQueueConfigContextType | undefined>(undefined);

export const WorkerQueueConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [configs, setConfigs] = useState<WorkerQueueConfig[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchConfigs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getAllWorkerQueueConfigs();
            setConfigs(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    const saveConfig = async (config: WorkerQueueConfig) => {
        setLoading(true);
        try {
            await apiSaveWorkerQueueConfig(config);
            // Optimistically update or refetch
            // For simplicity, just refetch after save
            await fetchConfigs();
        } catch (err: unknown) {
            setError(err instanceof Error ? err : new Error(String(err)));
            throw err; // Re-throw to allow form to handle error
        }
    };

    const removeConfig = async (queueName: string) => {
        setLoading(true);
        try {
            await apiDeleteWorkerQueueConfig(queueName);
            setConfigs(prevConfigs => prevConfigs.filter(c => c.queueName !== queueName));
        } catch (err: unknown) {
            setError(err instanceof Error ? err : new Error(String(err)));
            throw err; // Re-throw to allow component to handle error
        } finally {
            setLoading(false); // Ensure loading is false even if optimistic update was fast
        }
    };

    return (
        <WorkerQueueConfigContext.Provider value={{ configs, loading, error, fetchConfigs, saveConfig, removeConfig }}>
            {children}
        </WorkerQueueConfigContext.Provider>
    );
};

export const useWorkerQueueConfigs = (): WorkerQueueConfigContextType => {
    const context = useContext(WorkerQueueConfigContext);
    if (context === undefined) {
        throw new Error('useWorkerQueueConfigs must be used within a WorkerQueueConfigProvider');
    }
    return context;
}; 