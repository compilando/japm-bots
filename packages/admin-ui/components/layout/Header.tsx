import React from 'react';

interface HeaderProps {
    title?: string;
}

const Header: React.FC<HeaderProps> = ({ title = 'Panel de Administración' }) => {
    return (
        <header className="h-16 px-6 bg-slate-900/30 backdrop-blur-md flex items-center border-b border-white/10 sticky top-0 z-10">
            <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
            {/* Otros elementos del header como búsqueda, perfil de usuario, etc. podrían ir aquí */}
        </header>
    );
};

export default Header; 