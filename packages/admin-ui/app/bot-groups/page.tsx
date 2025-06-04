'use client';

import { BotGroupProvider } from "@/contexts/BotGroupContext";
import { BotTypeProvider } from "@/contexts/BotTypeContext";
import BotGroupList from "@/components/bot-groups/BotGroupList";
// import AdminLayout from "@/components/layout/AdminLayout"; // AdminLayout ya se aplica desde el RootLayout

export default function BotGroupsPage() {
    return (
        // AdminLayout ya se aplica desde el RootLayout, por lo que no es necesario aquí
        // a menos que se quiera un layout anidado con configuración específica.
        // Por ahora, asumimos que el RootLayout ya proporciona AdminLayout.
        <BotTypeProvider>
            <BotGroupProvider>
                {/* El título se puede pasar al Header a través de AdminLayout si se modifica AdminLayout para aceptar un título */}
                {/* O manejar el título directamente aquí o en BotGroupList */}
                <BotGroupList />
            </BotGroupProvider>
        </BotTypeProvider>
    );
} 