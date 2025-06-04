"use client"; // Necesario porque la página usará hooks del contexto

import { BotTypeProvider } from "@/contexts/BotTypeContext";
import BotTypeList from "@/components/bot-types/BotTypeList";

export default function BotTypesPage() {
    return (
        <BotTypeProvider>
            <div>
                <h1 className="text-3xl font-bold mb-6 text-white">Gestión de Tipos de Bot</h1>
                <BotTypeList />
            </div>
        </BotTypeProvider>
    );
} 