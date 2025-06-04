import React, { useState, useEffect } from 'react';
import type { BotTypeConfig } from '@bot-core/common';
import { useBotTypes } from '@/contexts/BotTypeContext';
import GlassCard from '@/components/GlassCard';

interface BotTypeFormProps {
    initialData?: BotTypeConfig | null | undefined; // undefined para nuevo, BotTypeConfig para editar, null para modal cerrado/no edición
    onClose: () => void;
}

const BotTypeForm: React.FC<BotTypeFormProps> = ({ initialData, onClose }) => {
    const { createBotType, updateBotType } = useBotTypes();

    const getDefaultFormData = (): Partial<BotTypeConfig> => ({
        botType: '',
        description: '',
        runtimeType: '',
        workerTargetQueue: '',
        defaultPriority: 10,
        retryAttempts: 3,
    });

    const [formData, setFormData] = useState<Partial<BotTypeConfig>>(getDefaultFormData());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditing = initialData && typeof initialData.botType === 'string'; // Es edición si initialData tiene botType

    useEffect(() => {
        if (isEditing && initialData) { // Modo edición con datos válidos
            setFormData({
                ...initialData,
                defaultPriority: initialData.defaultPriority ?? 10, // Asegurar valor si es null/undefined
                retryAttempts: initialData.retryAttempts ?? 3,   // Asegurar valor si es null/undefined
            });
        } else { // Modo creación o si initialData es null/undefined
            setFormData(getDefaultFormData());
        }
    }, [initialData, isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: Partial<BotTypeConfig>) => ({
            ...prev,
            [name]: (name === 'defaultPriority' || name === 'retryAttempts')
                ? (value === '' ? undefined : parseInt(value, 10)) // undefined si está vacío, sino parsear
                : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (!formData.botType || !formData.runtimeType || !formData.workerTargetQueue) {
            setError('Los campos Bot Type ID, Runtime Type, y Worker Target Queue son obligatorios.');
            setIsLoading(false);
            return;
        }

        try {
            // Prepara los datos para enviar, asegurando que los opcionales sean undefined si no están
            const dataToSubmit: BotTypeConfig = {
                botType: formData.botType!,
                runtimeType: formData.runtimeType!,
                workerTargetQueue: formData.workerTargetQueue!,
                description: formData.description || undefined,
                defaultPriority: formData.defaultPriority === undefined || isNaN(Number(formData.defaultPriority))
                    ? undefined
                    : Number(formData.defaultPriority),
                retryAttempts: formData.retryAttempts === undefined || isNaN(Number(formData.retryAttempts))
                    ? undefined
                    : Number(formData.retryAttempts),
            };

            if (isEditing && initialData?.botType) {
                await updateBotType(initialData.botType, dataToSubmit);
            } else {
                await createBotType(dataToSubmit);
            }
            onClose();
        } catch (err: unknown) {
            console.error("Error en el formulario:", err);
            if (err instanceof Error) {
                setError(err.message);
            } else if (typeof err === 'string') {
                setError(err);
            } else {
                setError('Ocurrió un error al guardar el tipo de bot.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Estilos para el contenedor del modal
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <GlassCard className="w-full max-w-lg shadow-2xl"> {/* GlassCard como base del modal */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <h2 className="text-2xl font-semibold text-white mb-6 text-center">
                        {isEditing ? 'Editar Tipo de Bot' : 'Crear Nuevo Tipo de Bot'}
                    </h2>

                    {error && (
                        <div className="bg-red-500/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4" role="alert">
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Bot Type ID - deshabilitado si está editando */}
                    <div>
                        <label htmlFor="botType" className="block text-sm font-medium text-sky-300 mb-1">Bot Type ID *</label>
                        <input
                            type="text"
                            name="botType"
                            id="botType"
                            value={formData.botType || ''}
                            onChange={handleChange}
                            required
                            disabled={isEditing} // Deshabilitado si estamos editando
                            className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder-slate-400"
                            placeholder="ej: miProcesoUnico"
                        />
                        {isEditing && <p className="text-xs text-slate-400 mt-1">El Bot Type ID no se puede cambiar después de la creación.</p>}
                    </div>

                    {/* Runtime Type */}
                    <div>
                        <label htmlFor="runtimeType" className="block text-sm font-medium text-sky-300 mb-1">Runtime Type *</label>
                        <input
                            type="text"
                            name="runtimeType"
                            id="runtimeType"
                            value={formData.runtimeType || ''}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder-slate-400"
                            placeholder="ej: n8n_myWorkflow, python_scraper_v1"
                        />
                    </div>

                    {/* Worker Target Queue */}
                    <div>
                        <label htmlFor="workerTargetQueue" className="block text-sm font-medium text-sky-300 mb-1">Worker Target Queue *</label>
                        <input
                            type="text"
                            name="workerTargetQueue"
                            id="workerTargetQueue"
                            value={formData.workerTargetQueue || ''}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder-slate-400"
                            placeholder="ej: n8n-workflows, python-scrapers"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-sky-300 mb-1">Descripción</label>
                        <textarea
                            name="description"
                            id="description"
                            value={formData.description || ''}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder-slate-400"
                            placeholder="Describe brevemente este tipo de bot"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Default Priority */}
                        <div>
                            <label htmlFor="defaultPriority" className="block text-sm font-medium text-sky-300 mb-1">Prioridad por Defecto</label>
                            <input
                                type="number"
                                name="defaultPriority"
                                id="defaultPriority"
                                value={formData.defaultPriority === undefined ? '' : formData.defaultPriority} // Muestra vacío si es undefined
                                onChange={handleChange}
                                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder-slate-400"
                            />
                        </div>

                        {/* Retry Attempts */}
                        <div>
                            <label htmlFor="retryAttempts" className="block text-sm font-medium text-sky-300 mb-1">Intentos de Reintento</label>
                            <input
                                type="number"
                                name="retryAttempts"
                                id="retryAttempts"
                                value={formData.retryAttempts === undefined ? '' : formData.retryAttempts} // Muestra vacío si es undefined
                                onChange={handleChange}
                                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder-slate-400"
                            />
                        </div>
                    </div>

                    {/* Botones de Acción */}
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
                            ) : (isEditing ? 'Guardar Cambios' : 'Crear Bot')}
                        </button>
                    </div>
                </form>
            </GlassCard>
        </div>
    );
};

export default BotTypeForm; 