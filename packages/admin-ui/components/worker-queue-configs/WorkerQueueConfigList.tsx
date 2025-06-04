'use client';

import React, { useState } from 'react';
import type { WorkerQueueConfig } from '@bot-core/common';
import { useWorkerQueueConfigs } from '@/contexts/WorkerQueueConfigContext';
import GlassCard from '@/components/GlassCard';
import WorkerQueueConfigForm from './WorkerQueueConfigForm';

// Reutilizamos los iconos definidos en BotTypeList o podemos definirlos aquí también
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c1.153 0 2.24.032 3.22.096m4.908 0a48.401 48.401 0 01-5.118-.029M15 5.79V4.5A2.25 2.25 0 0012.75 2.25h-1.5A2.25 2.25 0 009 4.5v1.29m0 0C9 7.529 9.21 8.226 9.408 8.919" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;

const WorkerQueueConfigList: React.FC = () => {
    const { configs, loading, error, removeConfig } = useWorkerQueueConfigs();
    const [editingConfig, setEditingConfig] = useState<WorkerQueueConfig | null | undefined>(null);
    const [showFormModal, setShowFormModal] = useState(false);

    const handleCreate = () => {
        setEditingConfig(undefined); // undefined para indicar creación
        setShowFormModal(true);
    };

    const handleEdit = (config: WorkerQueueConfig) => {
        setEditingConfig(config);
        setShowFormModal(true);
    };

    const handleDelete = async (queueName: string) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar la configuración para la cola "${queueName}"?`)) {
            try {
                await removeConfig(queueName);
                // Considerar un sistema de notificaciones (toast) en lugar de alert
            } catch (err: unknown) {
                console.error('Error al eliminar configuración de cola:', err);
                const message = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
                alert(`Error al eliminar: ${message}`);
            }
        }
    };

    const handleCloseModal = () => {
        setShowFormModal(false);
        setEditingConfig(null);
    };

    if (loading && configs.length === 0) {
        return <p className="text-slate-300 text-center py-10">Cargando configuraciones de colas...</p>;
    }

    if (error) {
        return <p className="text-red-400 bg-red-900/30 p-4 rounded-md text-center">Error al cargar configuraciones: {error.message}</p>;
    }

    return (
        <>
            <GlassCard className="w-full">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/50">
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500">
                        Configuración de Colas de Workers
                    </h2>
                    <button
                        onClick={handleCreate}
                        className="flex items-center bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    >
                        <PlusIcon /> <span className="ml-2">Nueva Configuración</span>
                    </button>
                </div>

                {configs.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="mt-2 text-lg font-medium text-slate-300">No hay configuraciones de colas</h3>
                        <p className="mt-1 text-sm text-slate-400">Empieza creando una nueva configuración para una cola de worker.</p>
                    </div>
                )}

                {configs.length > 0 && (
                    <div className="overflow-x-auto rounded-lg shadow-inner bg-slate-900/30 border border-slate-700/50">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-800/60">
                                <tr>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider">Nombre de Cola</th>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider">Descripción</th>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider text-center">Máx. Concurrencia</th>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider text-center">Timeout Semáforo (ms)</th>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/70">
                                {configs.map((config) => (
                                    <tr key={config.queueName} className="hover:bg-slate-800/50 transition-colors duration-150 ease-in-out">
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sky-400">{config.queueName}</td>
                                        <td className="px-6 py-4 text-slate-400 truncate max-w-md">{config.description || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-300 text-center">{config.maxConcurrency ?? 'Default Orchestrator'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-300 text-center">{config.timeoutMs ?? 'Default Orchestrator'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center space-x-3">
                                            <button
                                                onClick={() => handleEdit(config)}
                                                className="p-1.5 rounded-md text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20 transition-all duration-150"
                                                title="Editar"
                                            >
                                                <EditIcon />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(config.queueName)}
                                                className="p-1.5 rounded-md text-red-500 hover:text-red-400 hover:bg-red-500/20 transition-all duration-150"
                                                title="Eliminar"
                                            >
                                                <DeleteIcon />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>

            {showFormModal && (
                <WorkerQueueConfigForm
                    initialData={editingConfig}
                    onClose={handleCloseModal}
                />
            )}
        </>
    );
};

export default WorkerQueueConfigList; 