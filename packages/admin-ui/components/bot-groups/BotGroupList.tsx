'use client';

import React, { useState, Fragment } from 'react';
import { useBotGroups } from '@/contexts/BotGroupContext';
import BotGroupForm from './BotGroupForm';
import type { BotGroup } from '@bot-core/common';
import { PencilSquareIcon, TrashIcon, PlusCircleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'; // O usa tus propios SVGs
import GlassCard from '@/components/GlassCard'; // CORREGIDO: Eliminado /common de la ruta

const BotGroupList: React.FC = () => {
    const { botGroups, isLoading, error, deleteBotGroup, fetchBotGroups } = useBotGroups();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<BotGroup | null>(null);
    const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

    const handleCreateNew = () => {
        setEditingGroup(null);
        setIsModalOpen(true);
    };

    const handleEdit = (group: BotGroup) => {
        setEditingGroup(group);
        setIsModalOpen(true);
    };

    const handleDelete = async (groupId: string) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar el grupo ${groupId}? Esta acción no se puede deshacer.`)) {
            try {
                await deleteBotGroup(groupId);
            } catch (err: unknown) {
                console.error("Error deleting bot group from list:", err);
                alert(`Error al eliminar el grupo: ${(err as Error).message}`);
            }
        }
    };

    const toggleDescription = (groupId: string) => {
        setExpandedDescriptions(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const renderExecutionRule = (rule: BotGroup['executionRule']) => {
        if (!rule) return <span className="text-slate-400 italic">No definida</span>;
        let ruleText = `Tipo: ${rule.type.charAt(0).toUpperCase() + rule.type.slice(1).replace(/_/g, ' ')}`;
        if (rule.paramsRequired && rule.paramsRequired.length > 0) {
            ruleText += `, Params: ${rule.paramsRequired.join(', ')}`;
        }
        return ruleText;
    };

    if (isLoading && botGroups.length === 0) {
        return (
            <GlassCard className="p-6">
                <div className="text-center text-slate-300">
                    <svg className="animate-spin h-8 w-8 text-indigo-400 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cargando grupos de bots...
                </div>
            </GlassCard>
        );
    }

    if (error) {
        return (
            <GlassCard className="p-6">
                <div className="text-center text-red-400">
                    <p className="font-semibold">Error al cargar los grupos de bots:</p>
                    <p className="text-sm">{error}</p>
                    <button
                        onClick={() => fetchBotGroups()}
                        className="mt-4 px-4 py-2 bg-red-500/30 hover:bg-red-500/50 text-white rounded-md text-sm transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            </GlassCard>
        );
    }

    return (
        <Fragment>
            <GlassCard className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-white mb-4 sm:mb-0">Lista de Grupos de Bot</h2>
                    <button
                        onClick={handleCreateNew}
                        className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                        <PlusCircleIcon className="h-5 w-5 mr-2" />
                        Crear Nuevo Grupo
                    </button>
                </div>

                {botGroups.length === 0 ? (
                    <div className="text-center py-10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p className="mt-3 text-lg font-medium text-slate-400">No hay grupos de bots configurados.</p>
                        <p className="mt-1 text-sm text-slate-500">Comienza creando un nuevo grupo para organizar tus bots.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50">
                        <table className="min-w-full divide-y divide-slate-700">
                            <thead className="bg-slate-800/70">
                                <tr>
                                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">ID del Grupo</th>
                                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Nombre</th>
                                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Descripción</th>
                                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Tipos de Bot</th>
                                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Regla Ejecución</th>
                                    <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {botGroups.map((group) => (
                                    <tr key={group.groupId} className="hover:bg-slate-800/60 transition-colors duration-100">
                                        <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-indigo-300">{group.groupId}</td>
                                        <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-200">{group.name}</td>
                                        <td className="px-5 py-4 text-sm text-slate-300 max-w-xs">
                                            <div className="flex items-start">
                                                <span className={`truncate ${expandedDescriptions[group.groupId] ? '' : 'max-w-[200px]'}`}>
                                                    {group.description || <span className="text-slate-500 italic">N/A</span>}
                                                </span>
                                                {group.description && group.description.length > 30 && (
                                                    <button onClick={() => toggleDescription(group.groupId)} className="ml-2 text-indigo-400 hover:text-indigo-300 shrink-0">
                                                        {expandedDescriptions[group.groupId] ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-slate-300">
                                            {group.botTypes.length > 0 ? (
                                                <ul className="list-disc list-inside pl-1 space-y-0.5">
                                                    {group.botTypes.map((bt: string) => <li key={bt} className="text-xs truncate max-w-[150px]" title={bt}>{bt}</li>)}
                                                </ul>
                                            ) : (
                                                <span className="text-slate-500 italic">Ninguno</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-slate-300 max-w-md whitespace-normal">{renderExecutionRule(group.executionRule)}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            <div className="flex items-center justify-center space-x-3">
                                                <button
                                                    onClick={() => handleEdit(group)}
                                                    className="text-blue-400 hover:text-blue-300 transition-colors p-1 rounded-md hover:bg-blue-500/10"
                                                    title="Editar Grupo"
                                                >
                                                    <PencilSquareIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(group.groupId)}
                                                    className="text-red-400 hover:text-red-300 transition-colors p-1 rounded-md hover:bg-red-500/10"
                                                    title="Eliminar Grupo"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>

            {isModalOpen && (
                <BotGroupForm
                    initialData={editingGroup}
                    isEditing={!!editingGroup}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingGroup(null);
                    }}
                />
            )}
        </Fragment>
    );
};

export default BotGroupList; 