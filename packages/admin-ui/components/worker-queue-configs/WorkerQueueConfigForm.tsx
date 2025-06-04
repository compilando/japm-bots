'use client';

import React, { useState, useEffect } from 'react';
import type { WorkerQueueConfig } from '@bot-core/common';
import { useWorkerQueueConfigs } from '@/contexts/WorkerQueueConfigContext';
import GlassCard from '@/components/GlassCard';

interface WorkerQueueConfigFormProps {
    initialData?: WorkerQueueConfig | null | undefined; // undefined for new, WorkerQueueConfig for editing
    onClose: () => void;
}

const WorkerQueueConfigForm: React.FC<WorkerQueueConfigFormProps> = ({ initialData, onClose }) => {
    const { saveConfig } = useWorkerQueueConfigs();

    const getDefaultFormData = (): Partial<WorkerQueueConfig> => ({
        queueName: '',
        description: '',
        maxConcurrency: undefined, // Explicitly undefined for placeholder to show
        timeoutMs: undefined,     // Explicitly undefined for placeholder to show
    });

    const [formData, setFormData] = useState<Partial<WorkerQueueConfig>>(getDefaultFormData());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditing = initialData && typeof initialData.queueName === 'string' && initialData.queueName !== '';

    useEffect(() => {
        if (isEditing && initialData) {
            setFormData({
                ...initialData,
                maxConcurrency: initialData.maxConcurrency ?? undefined, // Ensure undefined if null/0 to show placeholder
                timeoutMs: initialData.timeoutMs ?? undefined, // Ensure undefined if null/0 to show placeholder
            });
        } else {
            setFormData(getDefaultFormData());
        }
    }, [initialData, isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: Partial<WorkerQueueConfig>) => ({
            ...prev,
            [name]: (name === 'maxConcurrency' || name === 'timeoutMs')
                ? (value === '' ? undefined : parseInt(value, 10))
                : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (!formData.queueName) {
            setError('El nombre de la cola (Queue Name) es obligatorio.');
            setIsLoading(false);
            return;
        }

        try {
            const dataToSubmit: WorkerQueueConfig = {
                queueName: formData.queueName!, // queueName is validated not to be empty
                description: formData.description || undefined,
                maxConcurrency: formData.maxConcurrency === undefined || isNaN(Number(formData.maxConcurrency))
                    ? undefined
                    : Number(formData.maxConcurrency),
                timeoutMs: formData.timeoutMs === undefined || isNaN(Number(formData.timeoutMs))
                    ? undefined
                    : Number(formData.timeoutMs),
            };

            await saveConfig(dataToSubmit);
            onClose();
        } catch (err: unknown) {
            console.error("Error en el formulario de WorkerQueueConfig:", err);
            const message = err instanceof Error ? err.message : 'Ocurrió un error al guardar la configuración.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <GlassCard className="w-full max-w-lg shadow-2xl">
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <h2 className="text-2xl font-semibold text-white mb-6 text-center">
                        {isEditing ? 'Editar Configuración de Cola' : 'Nueva Configuración de Cola'}
                    </h2>

                    {error && (
                        <div className="bg-red-500/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4" role="alert">
                            <p>{error}</p>
                        </div>
                    )}

                    <div>
                        <label htmlFor="queueName" className="block text-sm font-medium text-sky-300 mb-1">Nombre de la Cola (Queue Name) *</label>
                        <input
                            type="text"
                            name="queueName"
                            id="queueName"
                            value={formData.queueName || ''}
                            onChange={handleChange}
                            required
                            disabled={isEditing} // Queue name no es editable para configuraciones existentes
                            className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder-slate-400 disabled:opacity-70 disabled:cursor-not-allowed"
                            placeholder="ej: python-tasks, n8n-jobs"
                        />
                        {isEditing && <p className="text-xs text-slate-400 mt-1">El nombre de la cola no se puede cambiar después de la creación.</p>}
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-sky-300 mb-1">Descripción</label>
                        <textarea
                            name="description"
                            id="description"
                            value={formData.description || ''}
                            onChange={handleChange}
                            rows={2}
                            className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder-slate-400"
                            placeholder="Describe el propósito de esta cola (opcional)"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="maxConcurrency" className="block text-sm font-medium text-sky-300 mb-1">Máx. Concurrencia</label>
                            <input
                                type="number"
                                name="maxConcurrency"
                                id="maxConcurrency"
                                value={formData.maxConcurrency === undefined ? '' : formData.maxConcurrency}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder-slate-400"
                                placeholder="(ej: 5, defecto orchestrator)"
                            />
                            <p className="text-xs text-slate-400 mt-1">Dejar vacío para usar default del orchestrator.</p>
                        </div>

                        <div>
                            <label htmlFor="timeoutMs" className="block text-sm font-medium text-sky-300 mb-1">Timeout de Semáforo (ms)</label>
                            <input
                                type="number"
                                name="timeoutMs"
                                id="timeoutMs"
                                value={formData.timeoutMs === undefined ? '' : formData.timeoutMs}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder-slate-400"
                                placeholder="(ej: 30000, defecto orchestrator)"
                            />
                            <p className="text-xs text-slate-400 mt-1">Dejar vacío para usar default del orchestrator.</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-end space-x-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-6 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Procesando...
                                </>
                            ) : (isEditing ? 'Guardar Cambios' : 'Crear Configuración')}
                        </button>
                    </div>
                </form>
            </GlassCard>
        </div>
    );
};

export default WorkerQueueConfigForm; 