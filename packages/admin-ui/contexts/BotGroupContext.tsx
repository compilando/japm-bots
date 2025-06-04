'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { BotGroup, BotTypeConfig } from '@bot-core/common';
import {
    getAllBotGroups as apiGetAllBotGroups,
    createBotGroup as apiCreateBotGroup,
    updateBotGroup as apiUpdateBotGroup,
    deleteBotGroup as apiDeleteBotGroup,
    getBotGroupById as apiGetBotGroupById
} from '../services/botGroup.service';
import { useBotTypes } from './BotTypeContext'; // Necesario para acceder a los bot types

interface BotGroupContextType {
    botGroups: BotGroup[];
    isLoading: boolean;
    error: string | null;
    fetchBotGroups: () => Promise<void>;
    createBotGroup: (newGroup: BotGroup) => Promise<BotGroup | null>;
    updateBotGroup: (groupId: string, updates: Partial<Omit<BotGroup, 'groupId'>>) => Promise<BotGroup | null>;
    deleteBotGroup: (groupId: string) => Promise<void>;
    getBotGroupById: (groupId: string) => Promise<BotGroup | null>;
    // Para el formulario, es útil tener acceso a todos los BotTypeConfigs disponibles
    availableBotTypes: BotTypeConfig[];
}

const BotGroupContext = createContext<BotGroupContextType | undefined>(undefined);

export const BotGroupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [botGroups, setBotGroups] = useState<BotGroup[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const { botTypes: availableBotTypes, fetchBotTypes, loading: isLoadingBotTypes } = useBotTypes();

    const fetchBotGroups = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await apiGetAllBotGroups();
            setBotGroups(data);
        } catch (err: unknown) {
            setError((err as Error).message || 'Failed to fetch bot groups');
            console.error("Error fetching bot groups:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createBotGroup = async (newGroup: BotGroup) => {
        setIsLoading(true);
        setError(null);
        try {
            const created = await apiCreateBotGroup(newGroup);
            setBotGroups(prev => [...prev, created]);
            return created;
        } catch (err: unknown) {
            setError((err as Error).message || 'Failed to create bot group');
            console.error("Error creating bot group:", err);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const updateBotGroup = async (groupId: string, updates: Partial<Omit<BotGroup, 'groupId'>>) => {
        setIsLoading(true);
        setError(null);
        try {
            const updated = await apiUpdateBotGroup(groupId, updates);
            setBotGroups(prev => prev.map(group => (group.groupId === groupId ? updated : group)));
            return updated;
        } catch (err: unknown) {
            setError((err as Error).message || 'Failed to update bot group');
            console.error(`Error updating bot group ${groupId}:`, err);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteBotGroup = async (groupId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await apiDeleteBotGroup(groupId);
            setBotGroups(prev => prev.filter(group => group.groupId !== groupId));
        } catch (err: unknown) {
            setError((err as Error).message || 'Failed to delete bot group');
            console.error(`Error deleting bot group ${groupId}:`, err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const getBotGroupById = async (groupId: string): Promise<BotGroup | null> => {
        setIsLoading(true);
        setError(null);
        try {
            const group = await apiGetBotGroupById(groupId);
            return group;
        } catch (err: unknown) {
            setError((err as Error).message || `Failed to fetch bot group ${groupId}`);
            console.error(`Error fetching bot group ${groupId}:`, err);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBotGroups();
        if (availableBotTypes.length === 0 && !isLoadingBotTypes) {
            fetchBotTypes();
        }
    }, [fetchBotGroups, availableBotTypes.length, isLoadingBotTypes, fetchBotTypes]);

    return (
        <BotGroupContext.Provider value={{
            botGroups,
            isLoading,
            error,
            fetchBotGroups,
            createBotGroup,
            updateBotGroup,
            deleteBotGroup,
            getBotGroupById,
            availableBotTypes
        }}>
            {children}
        </BotGroupContext.Provider>
    );
};

export const useBotGroups = (): BotGroupContextType => {
    const context = useContext(BotGroupContext);
    if (context === undefined) {
        throw new Error('useBotGroups must be used within a BotGroupProvider');
    }
    return context;
}; 