import React from 'react';
import { useApp } from '../AppContext';
import { Role } from '../types';
import { Building2, UserCircle, RefreshCcw } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, setRole, resetDemoData } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-slate-900 p-1.5 rounded-lg">
                <Building2 className="w-5 h-5 text-white" />
             </div>
             <div>
                <h1 className="text-sm font-bold text-slate-900 tracking-wide">EUROPEAN LIFESTYLE SUITES</h1>
                <p className="text-[10px] text-slate-500 font-medium tracking-wider">MANTENIMIENTO DEMO • BY METODIKO</p>
             </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 rounded-full px-1 py-1 border border-slate-200">
                {[Role.MANAGEMENT, Role.MAINTENANCE, Role.CLEANING, Role.RECEPTION].map((r) => (
                    <button
                        key={r}
                        onClick={() => setRole(r)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            role === r 
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-100' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {r.split(' ')[0]} {/* Show short name */}
                    </button>
                ))}
            </div>
            
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                <button onClick={resetDemoData} title="Reiniciar Demo" className="text-slate-400 hover:text-rose-600 transition-colors">
                    <RefreshCcw className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                    <UserCircle className="w-6 h-6 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 hidden sm:block">{role}</span>
                </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {children}
      </main>
      
      <footer className="bg-slate-50 border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-xs text-slate-400">
                METODIKO DEMO VERSION 1.0 — Datos simulados localmente.
            </p>
        </div>
      </footer>
    </div>
  );
};