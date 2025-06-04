import React, { useState } from 'react';
import { useBotTypes } from '@/contexts/BotTypeContext'; // Ajusta la ruta si es necesario
import type { BotTypeConfig } from '@bot-core/common';
import GlassCard from '@/components/GlassCard';
import BotTypeForm from './BotTypeForm';

// Iconos mejorados (ejemplos, podrías usar una librería como Heroicons o FontAwesome)
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c1.153 0 2.24.032 3.22.096m4.908 0a48.401 48.401 0 01-5.118-.029M15 5.79V4.5A2.25 2.25 0 0012.75 2.25h-1.5A2.25 2.25 0 009 4.5v1.29m0 0C9 7.529 9.21 8.226 9.408 8.919" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;

const BotTypeList: React.FC = () => {
    const { botTypes, loading, error, removeBotType } = useBotTypes();
    const [editingBotType, setEditingBotType] = useState<BotTypeConfig | null | undefined>(null);
    const [showFormModal, setShowFormModal] = useState(false);

    const handleCreate = () => {
        setEditingBotType(undefined);
        setShowFormModal(true);
    };

    const handleEdit = (botType: BotTypeConfig) => {
        setEditingBotType(botType);
        setShowFormModal(true);
    };

    const handleDelete = async (botTypeId: string) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar el tipo de bot "${botTypeId}"?`)) {
            try {
                await removeBotType(botTypeId);
                // Considera usar un sistema de notificaciones (toast) en lugar de alert
            } catch (err: unknown) {
                console.error('Error al eliminar tipo de bot:', err);
                const message = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
                alert(`Error al eliminar: ${message}`);
            }
        }
    };

    const handleCloseModal = () => {
        setShowFormModal(false);
        setEditingBotType(null); // Resetear a null cuando se cierra
    };

    if (loading && botTypes.length === 0) {
        return <p className="text-slate-300 text-center py-10">Cargando tipos de bot...</p>;
    }

    if (error) {
        return <p className="text-red-400 bg-red-900/30 p-4 rounded-md text-center">Error al cargar tipos de bot: {error.message}</p>;
    }

    return (
        <>
            <GlassCard className="w-full">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/50">
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-purple-500">
                        Gestión de Tipos de Bot
                    </h2>
                    <button
                        onClick={handleCreate}
                        className="flex items-center bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    >
                        <PlusIcon /> <span className="ml-2">Crear Nuevo Tipo</span>
                    </button>
                </div>

                {botTypes.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="mt-2 text-lg font-medium text-slate-300">No hay tipos de bot</h3>
                        <p className="mt-1 text-sm text-slate-400">Empieza creando un nuevo tipo de bot.</p>
                    </div>
                )}

                {botTypes.length > 0 && (
                    <div className="overflow-x-auto rounded-lg shadow-inner bg-slate-900/30 border border-slate-700/50">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-800/60">
                                <tr>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider">ID BotType</th>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider">Runtime Type</th>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider">Worker Target Queue</th>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider">Descripción</th>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider text-center">Prioridad</th>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider text-center">Reintentos</th>
                                    <th scope="col" className="px-6 py-3.5 font-semibold text-slate-200 uppercase tracking-wider text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/70">
                                {botTypes.map((bot) => (
                                    <tr key={bot.botType} className="hover:bg-slate-800/50 transition-colors duration-150 ease-in-out">
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sky-400">{bot.botType}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-300">{bot.runtimeType}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-purple-400">{bot.workerTargetQueue || '-'}</td>
                                        <td className="px-6 py-4 text-slate-400 truncate max-w-xs">{bot.description || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-300 text-center">{bot.defaultPriority ?? '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-300 text-center">{bot.retryAttempts ?? '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center space-x-3">
                                            <button
                                                onClick={() => handleEdit(bot)}
                                                className="p-1.5 rounded-md text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20 transition-all duration-150"
                                                title="Editar"
                                            >
                                                <EditIcon />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(bot.botType)}
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
                <BotTypeForm
                    initialData={editingBotType}
                    onClose={handleCloseModal}
                />
            )}
        </>
    );
};

export default BotTypeList; 