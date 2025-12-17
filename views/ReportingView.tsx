import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { ASSETS, ISSUE_TYPES, ROOMS } from '../constants';
import { Impact, Role, TicketStatus, Urgency } from '../types';
import { Button } from '../components/Button';
import { PlusCircle, List, CheckCircle } from 'lucide-react';
import { getStatusColor } from '../utils';

export const ReportingView: React.FC = () => {
    const { addTicket, role, tickets } = useApp();
    const [mode, setMode] = useState<'FORM' | 'LIST'>('FORM');
    const [successMsg, setSuccessMsg] = useState('');

    // Form State
    const [room, setRoom] = useState(ROOMS[0].number);
    const [asset, setAsset] = useState(ASSETS[0]);
    const [issue, setIssue] = useState(ISSUE_TYPES[0]);
    const [urgency, setUrgency] = useState<Urgency>(Urgency.LOW);
    const [impact, setImpact] = useState<Impact>(Impact.NONE);
    const [desc, setDesc] = useState('');
    const [isOccupied, setIsOccupied] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addTicket({
            roomNumber: room,
            asset,
            issueType: issue,
            urgency,
            impact,
            description: desc,
            isOccupied,
            createdBy: role,
            notes: [],
            needsPart: false,
            needsVendor: false
        });
        
        // Reset and Show feedback
        setDesc('');
        setSuccessMsg(`Ticket creado correctamente para Habitación ${room}`);
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const myTickets = tickets.filter(t => t.createdBy === role).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex gap-4 mb-8 border-b border-slate-200 pb-1">
                <button 
                    onClick={() => setMode('FORM')} 
                    className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'FORM' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <PlusCircle className="w-4 h-4"/> Reportar Incidencia
                </button>
                <button 
                    onClick={() => setMode('LIST')} 
                    className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'LIST' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <List className="w-4 h-4"/> Mis Reportes ({myTickets.length})
                </button>
            </div>

            {mode === 'FORM' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                        <h2 className="font-bold text-slate-800">Nuevo Reporte — {role}</h2>
                        <p className="text-xs text-slate-500">Complete los detalles para notificar a mantenimiento.</p>
                    </div>
                    
                    {successMsg && (
                        <div className="bg-green-50 border-b border-green-100 text-green-700 px-6 py-3 flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4"/> {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Habitación</label>
                                <select 
                                    className="w-full bg-white text-slate-900 border-slate-300 rounded-md shadow-sm focus:border-slate-500 focus:ring-slate-500 py-2 border px-3"
                                    value={room} onChange={e => setRoom(e.target.value)}
                                >
                                    {ROOMS.map(r => <option key={r.number} value={r.number}>{r.number} ({r.type})</option>)}
                                </select>
                            </div>
                            
                            <div className="flex items-end mb-2">
                                <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-2 rounded-md w-full hover:bg-slate-100 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={isOccupied} 
                                        onChange={e => setIsOccupied(e.target.checked)} 
                                        className="rounded text-slate-900 focus:ring-slate-900 h-4 w-4"
                                    />
                                    <span className="text-sm font-medium text-slate-700">¿Habitación Ocupada?</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Activo / Categoría</label>
                                <select 
                                    className="w-full bg-white text-slate-900 border-slate-300 rounded-md shadow-sm focus:border-slate-500 focus:ring-slate-500 py-2 border px-3"
                                    value={asset} onChange={e => setAsset(e.target.value)}
                                >
                                    {ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Problema</label>
                                <select 
                                    className="w-full bg-white text-slate-900 border-slate-300 rounded-md shadow-sm focus:border-slate-500 focus:ring-slate-500 py-2 border px-3"
                                    value={issue} onChange={e => setIssue(e.target.value)}
                                >
                                    {ISSUE_TYPES.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Urgencia Visual</label>
                                <div className="flex gap-2">
                                    {[Urgency.LOW, Urgency.MEDIUM, Urgency.HIGH].map(u => (
                                        <button 
                                            key={u}
                                            type="button"
                                            onClick={() => setUrgency(u)}
                                            className={`flex-1 py-2 text-sm rounded-md border ${urgency === u 
                                                ? 'bg-slate-800 text-white border-slate-800' 
                                                : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            {u}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Impacto Huésped</label>
                                 <div className="flex gap-2">
                                    {[Impact.NONE, Impact.ANNOYING, Impact.BLOCKING].map(i => (
                                        <button 
                                            key={i}
                                            type="button"
                                            onClick={() => setImpact(i)}
                                            className={`flex-1 py-2 text-xs rounded-md border ${impact === i 
                                                ? 'bg-slate-800 text-white border-slate-800' 
                                                : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            {i}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción Detallada</label>
                            <textarea 
                                className="w-full bg-white text-slate-900 border-slate-300 rounded-md shadow-sm focus:border-slate-500 focus:ring-slate-500 py-2 border px-3"
                                rows={3}
                                placeholder="Describa el problema..."
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                                required
                            />
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <Button type="submit" size="lg" className="w-full md:w-auto">Crear Ticket de Mantenimiento</Button>
                        </div>
                    </form>
                </div>
            )}

            {mode === 'LIST' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Habitación</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Detalle</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {myTickets.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{t.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{t.roomNumber}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        <div className="font-medium text-slate-700">{t.asset}</div>
                                        <div className="truncate max-w-xs">{t.description}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(t.status)}`}>
                                            {t.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {myTickets.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-slate-500 text-sm">
                                        No has reportado incidencias recientes.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};