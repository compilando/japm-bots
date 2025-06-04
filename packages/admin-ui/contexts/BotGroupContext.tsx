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
import { useBotTypes } from './BotTypeContext';

interface BotGroupContextType {
    botGroups: BotGroup[];
    isLoading: boolean;
    error: string | null;
    fetchBotGroups: () => Promise<void>; // Para recarga manual
    createBotGroup: (newGroup: BotGroup) => Promise<BotGroup | null>;
    updateBotGroup: (groupId: string, updates: Partial<Omit<BotGroup, 'groupId'>>) => Promise<BotGroup | null>;
    deleteBotGroup: (groupId: string) => Promise<void>;
    getBotGroupById: (groupId: string) => Promise<BotGroup | null>;
    availableBotTypes: BotTypeConfig[];
}

const BotGroupContext = createContext<BotGroupContextType | undefined>(undefined);

export const BotGroupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [botGroups, setBotGroups] = useState<BotGroup[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const {
        botTypes: availableBotTypes,
        fetchBotTypes: originalFetchBotTypes, // Renombrada para claridad
        loading: isLoadingBotTypes,
        error: errorBotTypes
    } = useBotTypes();

    const memorizedFetchBotGroups = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log("[BotGroupContext] memorizedFetchBotGroups: Fetching all bot groups...");
            const data = await apiGetAllBotGroups();
            setBotGroups(data);
            console.log("[BotGroupContext] memorizedFetchBotGroups: Bot groups fetched successfully:", data.length);
        } catch (err: unknown) {
            const errorMessage = (err as Error).message || 'Failed to fetch bot groups';
            setError(errorMessage);
            console.error("[BotGroupContext] memorizedFetchBotGroups: Error fetching bot groups:", errorMessage, err);
        } finally {
            setIsLoading(false);
        }
    }, []); // Dependencias vacías, función estable

    // Efecto para cargar botGroups al montar
    useEffect(() => {
        console.log("[BotGroupContext] Mount effect: Triggering memorizedFetchBotGroups.");
        memorizedFetchBotGroups();
    }, [memorizedFetchBotGroups]); // Se ejecuta una vez ya que memorizedFetchBotGroups es estable

    // Efecto para cargar botTypes si es necesario, observando sus condiciones y la función de BotTypeContext
    useEffect(() => {
        console.log("[BotGroupContext] BotTypes check effect triggered. Conditions - available: ", availableBotTypes.length, "loading: ", isLoadingBotTypes, "error: ", !!errorBotTypes);
        if (availableBotTypes.length === 0 && !isLoadingBotTypes && !errorBotTypes) {
            console.log("[BotGroupContext] Conditions met for fetching bot types via originalFetchBotTypes.");
            originalFetchBotTypes();
        } else {
            if (availableBotTypes.length > 0) console.log("[BotGroupContext] Bot types already available or not needed now.");
            if (isLoadingBotTypes) console.log("[BotGroupContext] Bot types are currently being loaded by BotTypeContext.");
            if (errorBotTypes) console.log("[BotGroupContext] An error previously occurred while fetching bot types in BotTypeContext.");
        }
    }, [availableBotTypes.length, isLoadingBotTypes, errorBotTypes, originalFetchBotTypes]);

    const createBotGroup = useCallback(async (newGroup: BotGroup) => {
        setIsLoading(true); // Podría ser específico para la operación de creación
        setError(null);
        try {
            const created = await apiCreateBotGroup(newGroup);
            await memorizedFetchBotGroups(); // Recargar la lista completa
            return created;
        } catch (err: unknown) {
            const errorMessage = (err as Error).message || 'Failed to create bot group';
            // No establecer error global aquí si memorizedFetchBotGroups lo maneja,
            // o manejarlo específicamente para la operación de creación.
            console.error("[BotGroupContext] Error creating bot group:", errorMessage, err);
            setError(errorMessage); // Establecer error para que la UI lo muestre
            return null;
        } finally {
            // setIsLoading(false); // El setIsLoading global lo maneja memorizedFetchBotGroups
        }
    }, [memorizedFetchBotGroups]);

    const updateBotGroup = useCallback(async (groupId: string, updates: Partial<Omit<BotGroup, 'groupId'>>) => {
        // Similar a createBotGroup, manejar isLoading/error específico si es necesario
        try {
            const updated = await apiUpdateBotGroup(groupId, updates);
            await memorizedFetchBotGroups(); // Recargar
            return updated;
        } catch (err: unknown) {
            const errorMessage = (err as Error).message || 'Failed to update bot group';
            console.error(`[BotGroupContext] Error updating bot group ${groupId}:`, errorMessage, err);
            setError(errorMessage);
            return null;
        }
    }, [memorizedFetchBotGroups]);

    const deleteBotGroup = useCallback(async (groupId: string) => {
        try {
            await apiDeleteBotGroup(groupId);
            await memorizedFetchBotGroups(); // Recargar
        } catch (err: unknown) {
            const errorMessage = (err as Error).message || 'Failed to delete bot group';
            console.error(`[BotGroupContext] Error deleting bot group ${groupId}:`, errorMessage, err);
            setError(errorMessage);
            throw err; // Re-lanzar para que el componente que llama pueda manejarlo si es necesario
        }
    }, [memorizedFetchBotGroups]);

    // getBotGroupById no debería necesitar recargar toda la lista, es una lectura directa.
    const getBotGroupById = useCallback(async (groupId: string): Promise<BotGroup | null> => {
        // Este setIsLoading es para la operación de obtener UN grupo, no la lista general.
        // Podríamos tener un estado de carga separado para esto si fuera una operación larga o común.
        // Por ahora, no afecta el isLoading global de la lista.
        // setIsLoading(true); 
        // setError(null);
        try {
            const group = await apiGetBotGroupById(groupId);
            return group;
        } catch (err: unknown) {
            const errorMessage = (err as Error).message || `Failed to fetch bot group ${groupId}`;
            // setError(errorMessage); // No afectar el error global de la lista por esto.
            console.error(`[BotGroupContext] Error fetching bot group ${groupId}:`, errorMessage, err);
            return null;
        } finally {
            // setIsLoading(false);
        }
    }, []);

    return (
        <BotGroupContext.Provider value={{
            botGroups,
            isLoading,
            error,
            fetchBotGroups: memorizedFetchBotGroups, // Exponer para recarga manual
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