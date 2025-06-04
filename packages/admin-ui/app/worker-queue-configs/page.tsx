import React from 'react';
import { WorkerQueueConfigProvider } from '@/contexts/WorkerQueueConfigContext';
import WorkerQueueConfigList from '@/components/worker-queue-configs/WorkerQueueConfigList';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Configuración de Colas de Workers',
    description: 'Gestionar la configuración de concurrencia y timeouts para las colas de workers.',
};

const WorkerQueueConfigsPage: React.FC = () => {
    return (
        <WorkerQueueConfigProvider>
            <div className="container mx-auto py-2 md:py-4">
                {/* El título principal ya está en el componente GlassCard dentro de WorkerQueueConfigList */}
                {/* Si se quisiera un título de página por encima de la tarjeta, se añadiría aquí. */}
                <WorkerQueueConfigList />
            </div>
        </WorkerQueueConfigProvider>
    );
};

export default WorkerQueueConfigsPage; 