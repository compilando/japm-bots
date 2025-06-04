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
    fetchBotTypes: () => Promise<void>;
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

    const fetchBotTypes = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiGetBotTypes();
            setBotTypes(data);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchBotTypeById = useCallback(async (botTypeId: string): Promise<BotTypeConfig | null> => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiGetBotType(botTypeId);
            setLoading(false);
            return data;
        } catch (err) {
            setError(err as Error);
            setLoading(false);
            return null;
        }
    }, []);

    const createBotType = useCallback(async (newBotType: Omit<BotTypeConfig, 'botType'> & { botType: string }) => {
        setLoading(true);
        setError(null);
        try {
            await apiCreateBotType(newBotType);
            await fetchBotTypes();
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchBotTypes]);

    const updateBotType = useCallback(async (botTypeId: string, updatedData: Partial<Omit<BotTypeConfig, 'botType'>>) => {
        setLoading(true);
        setError(null);
        try {
            await apiUpdateBotType(botTypeId, updatedData);
            await fetchBotTypes();
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchBotTypes]);

    const removeBotType = useCallback(async (botTypeId: string) => {
        setLoading(true);
        setError(null);
        try {
            await apiDeleteBotType(botTypeId);
            await fetchBotTypes();
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchBotTypes]);

    useEffect(() => {
        fetchBotTypes();
    }, [fetchBotTypes]);

    return (
        <BotTypeContext.Provider value={{
            botTypes,
            loading,
            error,
            fetchBotTypes,
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