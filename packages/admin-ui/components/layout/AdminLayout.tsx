import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface AdminLayoutProps {
    children: React.ReactNode;
    headerTitle?: string; // Optional title for the header, can be set by pages
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, headerTitle }) => {
    return (
        <div className="flex min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-slate-200">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header title={headerTitle} />
                <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout; 