"use client"; // Necesario para Context API en App Router

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { BotTypeConfig } from '@bot-core/common';
import {
    getBotTypes as apiGetBotTypes,
    createBotType as apiCreateBotType,
    updateBotType as apiUpdateBotType,
    deleteBotType as apiDeleteBotType,
    getBotType as apiGetBotType
} from '@/services/botType.service'; // Ajusta la ruta si es necesario

interface BotTypeContextType {
    botTypes: BotTypeConfig[];
    loading: boolean;
    error: Error | null;
    fetchBotTypes: (options?: { force?: boolean }) => Promise<void>;
    refreshBotTypes: () => Promise<void>;
    fetchBotTypeById: (botTypeId: string) => Promise<BotTypeConfig | null>;
    createBotType: (newBotType: Omit<BotTypeConfig, 'botType'> & { botType: string }) => Promise<void>;
    updateBotType: (botTypeId: string, updatedData: Partial<Omit<BotTypeConfig, 'botType'>>) => Promise<void>;
    removeBotType: (botTypeId: string) => Promise<void>;
}

const BotTypeContext = createContext<BotTypeContextType | undefined>(undefined);

export const BotTypeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [botTypes, setBotTypes] = useState<BotTypeConfig[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [initialFetchDone, setInitialFetchDone] = useState<boolean>(false);

    const fetchBotTypes = useCallback(async (options: { force?: boolean } = {}) => {
        const { force = false } = options;

        if (!force && botTypes.length > 0 && !error) {
            console.log("[BotTypeContext] fetchBotTypes: Skipping, data exists, no error, not forced.");
            return;
        }
        if (!force && initialFetchDone && loading) {
            console.log("[BotTypeContext] fetchBotTypes: Skipping, not forced, initial fetch done, already loading.");
            return;
        }

        console.log(`[BotTypeContext] fetchBotTypes: Proceeding. Force: ${force}, InitialFetchDone: ${initialFetchDone}, Length: ${botTypes.length}, Error: ${!!error}`);
        setLoading(true);
        setError(null);
        try {
            const data = await apiGetBotTypes();
            setBotTypes(data);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
            setInitialFetchDone(true);
        }
    }, [loading, botTypes.length, error, initialFetchDone]);

    useEffect(() => {
        if (!initialFetchDone) {
            console.log("[BotTypeContext] useEffect: Initial fetch not done, calling fetchBotTypes.");
            fetchBotTypes(); // Initial fetch on mount
        }
    }, [initialFetchDone, fetchBotTypes]);

    const refreshBotTypes = useCallback(() => {
        console.log("[BotTypeContext] refreshBotTypes called.");
        return fetchBotTypes({ force: true });
    }, [fetchBotTypes]);

    const fetchBotTypeById = useCallback(async (botTypeId: string): Promise<BotTypeConfig | null> => {
        // This is a specific fetch, usually not subject to the general list loading logic.
        // However, we might want to add similar loading/error states if it becomes complex.
        // For now, keep it simple.
        try {
            const data = await apiGetBotType(botTypeId);
            return data;
        } catch (err) {
            // setError(err as Error); // Decide if this should set the global error
            console.error(`[BotTypeContext] Error fetching bot type by ID ${botTypeId}:`, err);
            return null;
        }
    }, []);

    const createBotType = useCallback(async (newBotType: Omit<BotTypeConfig, 'botType'> & { botType: string }) => {
        try {
            await apiCreateBotType(newBotType);
            await refreshBotTypes(); // Refresh list after creation
        } catch (err) {
            setError(err as Error); // Set global error for creation failure
            throw err; // Re-throw for the form to handle
        }
    }, [refreshBotTypes]);

    const updateBotType = useCallback(async (botTypeId: string, updatedData: Partial<Omit<BotTypeConfig, 'botType'>>) => {
        try {
            await apiUpdateBotType(botTypeId, updatedData);
            await refreshBotTypes(); // Refresh list after update
        } catch (err) {
            setError(err as Error);
            throw err;
        }
    }, [refreshBotTypes]);

    const removeBotType = useCallback(async (botTypeId: string) => {
        try {
            await apiDeleteBotType(botTypeId);
            await refreshBotTypes(); // Refresh list after deletion
        } catch (err) {
            setError(err as Error);
            throw err;
        }
    }, [refreshBotTypes]);

    return (
        <BotTypeContext.Provider value={{
            botTypes,
            loading,
            error,
            fetchBotTypes,
            refreshBotTypes,
            fetchBotTypeById,
            createBotType,
            updateBotType,
            removeBotType
        }}>
            {children}
        </BotTypeContext.Provider>
    );
};

export const useBotTypes = (): BotTypeContextType => {
    const context = useContext(BotTypeContext);
    if (context === undefined) {
        throw new Error('useBotTypes must be used within a BotTypeProvider');
    }
    return context;
}; 