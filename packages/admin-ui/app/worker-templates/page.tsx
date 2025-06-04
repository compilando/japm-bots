'use client';

import WorkerTemplateGenerator from "@/components/worker-templates/WorkerTemplateGenerator";

export default function WorkerTemplatesPage() {
    return (
        // El AdminLayout ya es aplicado por el RootLayout
        // El título específico de la página se manejará dentro de WorkerTemplateGenerator o en AdminLayout globalmente si se prefiere.
        <WorkerTemplateGenerator />
    );
} 