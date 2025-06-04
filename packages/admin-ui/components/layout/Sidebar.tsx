import Link from 'next/link';
import React from 'react';
import { RectangleStackIcon, CodeBracketSquareIcon } from '@heroicons/react/24/outline';

// Placeholder icons (replace with actual icons later)
const PlaceholderIcon = () => <span className="mr-2">❖</span>;
const BotTypeIcon = () => <span className="mr-2">🔩</span>;
const CogIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m1.5 0H21m-1.5 0H5.25M9 4.5h6m-6 9h6m-6-4.5h6m0 0v3.75m0-3.75a3 3 0 013 3V9m-9 3V9a3 3 0 013-3h.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

const Sidebar = () => {
    const navItems = [
        { href: '/', label: 'Dashboard', icon: <PlaceholderIcon /> },
        { href: '/bot-types', label: 'Tipos de Bot', icon: <BotTypeIcon /> },
        {
            href: '/bot-groups',
            label: 'Grupos de Bot',
            icon: <RectangleStackIcon className="w-5 h-5 mr-2" />
        },
        {
            href: '/worker-queue-configs',
            label: 'Conf. de Colas',
            icon: <CogIcon />
        },
        {
            href: '/worker-templates',
            label: 'Plantillas de Worker',
            icon: <CodeBracketSquareIcon className="w-5 h-5 mr-2" />
        },
    ];

    return (
        <aside className="w-64 min-h-screen p-4 bg-white/5 backdrop-blur-md border-r border-white/10">
            <div className="mb-8 text-center">
                <Link href="/" className="text-2xl font-bold text-white hover:text-slate-200 transition-colors">
                    BotAdmin
                </Link>
            </div>
            <nav>
                <ul>
                    {navItems.map((item) => (
                        <li key={item.label} className="mb-2">
                            <Link href={item.href} className="flex items-center p-2 text-slate-200 hover:bg-white/10 rounded-lg transition-colors">
                                {item.icon}
                                {item.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
};

export default Sidebar; 