'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import type { BotGroup, BotGroupExecutionRule } from '@bot-core/common';
import { useBotGroups } from '@/contexts/BotGroupContext';

interface BotGroupFormProps {
    initialData?: BotGroup | null;
    isEditing: boolean;
    onClose: () => void;
}

const executionRuleTypes: BotGroupExecutionRule['type'][] = ['sequential', 'parallel_any', 'parallel_all'];

const BotGroupForm: React.FC<BotGroupFormProps> = ({ initialData, isEditing, onClose }) => {
    const { createBotGroup, updateBotGroup, availableBotTypes, isLoading, error: contextError } = useBotGroups();

    const [groupId, setGroupId] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedBotTypes, setSelectedBotTypes] = useState<string[]>([]);
    const [executionType, setExecutionType] = useState<BotGroupExecutionRule['type']>(executionRuleTypes[0]);
    const [paramsRequiredStr, setParamsRequiredStr] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (isEditing && initialData) {
            setGroupId(initialData.groupId);
            setName(initialData.name || '');
            setDescription(initialData.description || '');
            setSelectedBotTypes(initialData.botTypes || []);
            setExecutionType(initialData.executionRule?.type || executionRuleTypes[0]);
            setParamsRequiredStr((initialData.executionRule?.paramsRequired || []).join(', '));
        } else {
            setGroupId('');
            setName('');
            setDescription('');
            setSelectedBotTypes([]);
            setExecutionType(executionRuleTypes[0]);
            setParamsRequiredStr('');
        }
    }, [initialData, isEditing]);

    const handleBotTypeSelection = (botType: string) => {
        setSelectedBotTypes(prev =>
            prev.includes(botType) ? prev.filter(bt => bt !== botType) : [...prev, botType]
        );
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!isEditing && !groupId.trim()) {
            setFormError('Group ID es requerido para crear un nuevo grupo.');
            return;
        }
        if (!name.trim()) {
            setFormError('Nombre del grupo es requerido.');
            return;
        }
        if (selectedBotTypes.length === 0) {
            setFormError('Debe seleccionar al menos un tipo de bot.');
            return;
        }

        const paramsRequired = paramsRequiredStr.split(',').map(p => p.trim()).filter(p => p !== '');
        const executionRule: BotGroupExecutionRule = { type: executionType, paramsRequired };

        const groupData: BotGroup = {
            groupId: groupId.trim(),
            name: name.trim(),
            description: description.trim(),
            botTypes: selectedBotTypes,
            executionRule,
        };

        try {
            if (isEditing && initialData) {
                const { groupId: currentGroupIdInput, ...updates } = groupData;
                if (initialData.groupId !== currentGroupIdInput && currentGroupIdInput.trim() !== initialData.groupId) {
                    console.warn("Se intentó cambiar groupId en modo edición via input aunque esté deshabilitado, usando el groupId original.");
                }
                await updateBotGroup(initialData.groupId, updates);
            } else {
                await createBotGroup(groupData);
            }
            onClose();
        } catch (err: unknown) {
            console.error("Error submitting BotGroup form:", err);
            setFormError((err as Error).message || 'Error al guardar el grupo de bot.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-slate-800/80 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800/50">
                <h2 className="text-2xl font-semibold text-white mb-6">{isEditing ? 'Editar' : 'Crear Nuevo'} Grupo de Bots</h2>

                {formError && <div className="mb-4 p-3 bg-red-500/20 text-red-300 border border-red-500/30 rounded-md">{formError}</div>}
                {contextError && !formError && <div className="mb-4 p-3 bg-red-500/20 text-red-300 border border-red-500/30 rounded-md">Error: {contextError}</div>}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="groupId" className="block text-sm font-medium text-slate-300 mb-1">Group ID</label>
                        <input
                            type="text"
                            name="groupId"
                            id="groupId"
                            value={groupId}
                            onChange={(e) => setGroupId(e.target.value)}
                            disabled={isEditing}
                            className="mt-1 block w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white disabled:bg-slate-600/30 disabled:text-slate-400"
                            placeholder={isEditing ? 'ID del Grupo (no editable)' : 'ej: marketing_bots'}
                        />
                    </div>

                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Nombre del Grupo</label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                            placeholder='ej: Bots de Soporte Nivel 1'
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1">Descripción (Opcional)</label>
                        <textarea
                            name="description"
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="mt-1 block w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white resize-none"
                            placeholder='Descripción detallada del propósito de este grupo de bots...'
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipos de Bot (Seleccione al menos uno)</label>
                        {availableBotTypes.length === 0 && <p className='text-sm text-slate-400 italic'>No hay tipos de bot configurados. Por favor, cree algunos primero.</p>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-3 bg-slate-700/30 rounded-md border border-slate-600/50 scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-700/50">
                            {availableBotTypes.map((botType) => (
                                <label key={botType.botType} className="flex items-center space-x-2 p-2.5 rounded-md hover:bg-slate-600/60 transition-colors cursor-pointer bg-slate-900/30 border border-slate-700/80">
                                    <input
                                        type="checkbox"
                                        checked={selectedBotTypes.includes(botType.botType)}
                                        onChange={() => handleBotTypeSelection(botType.botType)}
                                        className="h-4 w-4 rounded border-slate-500 text-indigo-600 focus:ring-indigo-500 bg-slate-600 focus:ring-offset-slate-800 shrink-0"
                                    />
                                    <span className="text-xs text-slate-200 truncate" title={botType.name || botType.botType}>{botType.name || botType.botType}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <fieldset className="space-y-3 p-3 bg-slate-700/30 rounded-md border border-slate-600/50">
                        <legend className="text-sm font-medium text-slate-300 mb-1 px-1">Regla de Ejecución</legend>
                        <div>
                            <label htmlFor="executionType" className="block text-sm font-medium text-slate-300 mb-1">Tipo de Ejecución</label>
                            <select
                                id="executionType"
                                name="executionType"
                                value={executionType}
                                onChange={(e) => setExecutionType(e.target.value as BotGroupExecutionRule['type'])}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-slate-700 text-white"
                            >
                                {executionRuleTypes.map(type => (
                                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="paramsRequired" className="block text-sm font-medium text-slate-300 mb-1">Parámetros Requeridos del Payload (Opcional, separados por coma)</label>
                            <input
                                type="text"
                                name="paramsRequired"
                                id="paramsRequired"
                                value={paramsRequiredStr}
                                onChange={(e) => setParamsRequiredStr(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                                placeholder='ej: userId, productId, campaignId'
                            />
                            <p className="mt-1 text-xs text-slate-400">Estos parámetros deben estar presentes en el payload de la tarea para que un bot de este grupo sea considerado para ejecución.</p>
                        </div>
                    </fieldset>

                    <div className="flex justify-end space-x-3 pt-3 border-t border-slate-700/50">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-slate-500 transition-colors disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center"
                        >
                            {isLoading && (
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {isLoading ? (isEditing ? 'Guardando...' : 'Creando...') : (isEditing ? 'Guardar Cambios' : 'Crear Grupo')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BotGroupForm; 