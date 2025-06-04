import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    // Add any other props you might need, e.g., for varying blur, opacity, etc.
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = '' }) => {
    return (
        <div
            className={`
        bg-slate-800/40 backdrop-blur-xl 
        rounded-2xl 
        border border-slate-700/80 
        shadow-2xl shadow-purple-900/30 
        overflow-hidden 
        ${className} 
      `}
        >
            {/* Efecto de brillo sutil en el borde superior e izquierdo */}
            <div className="absolute top-0 left-0 w-full h-full 
                          bg-gradient-to-br from-white/10 via-transparent to-transparent 
                          opacity-60 rounded-2xl pointer-events-none" />
            <div className="relative z-10 p-6"> {/* Contenido debe estar por encima del brillo */}
                {children}
            </div>
        </div>
    );
};

export default GlassCard; 