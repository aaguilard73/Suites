import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { ASSETS, ISSUE_TYPES, ROOMS } from '../constants';
import { Impact, Role, Ticket, TicketStatus, Urgency } from '../types';
import { Button } from '../components/Button';
import { getStatusColor, getUrgencyColor } from '../utils';
import { Copy, AlertTriangle, MessageSquareText, PlusCircle, ListChecks } from 'lucide-react';

const estimateETA = (t: Ticket) => {
  // Etiquetado como DEMO/estimación, sin prometer SLA real.
  switch (t.status) {
    case TicketStatus.OPEN:
      return 'Estimación DEMO: asignación 30–60 min';
    case TicketStatus.IN_PROGRESS:
      return 'Estimación DEMO: en atención 30–90 min';
    case TicketStatus.WAITING_PART:
      return 'Estimación DEMO: en espera de refacción 24–48 h (según disponibilidad)';
    case TicketStatus.VENDOR:
      return 'Estimación DEMO: proveedor 24–72 h (según agenda)';
    case TicketStatus.RESOLVED:
      return 'Estimación DEMO: verificación 15–30 min';
    case TicketStatus.VERIFIED:
      return 'Cerrado';
    default:
      return 'Estimación DEMO';
  }
};

const guestMessage = (t: Ticket) => {
  const base = `Hab ${t.roomNumber} — ${t.asset}.`;
  switch (t.status) {
    case TicketStatus.OPEN:
      return `${base} Ya registramos tu reporte. Estamos asignando técnico. ${estimateETA(t)}.`;
    case TicketStatus.IN_PROGRESS:
      return `${base} Nuestro equipo ya está atendiendo el caso. ${estimateETA(t)}.`;
    case TicketStatus.WAITING_PART:
      return `${base} Estamos en espera de refacción para completar la solución. ${estimateETA(t)}.`;
    case TicketStatus.VENDOR:
      return `${base} El caso fue escalado a proveedor especializado para resolverlo. ${estimateETA(t)}.`;
    case TicketStatus.RESOLVED:
      return `${base} La solución ya fue aplicada. Estamos por verificar que todo funcione correctamente. ${estimateETA(t)}.`;
    case TicketStatus.VERIFIED:
      return `${base} Quedó resuelto y verificado. Gracias por tu paciencia.`;
    default:
      return `${base} Seguimos en proceso.`;
  }
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    try {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
};

export const ReceptionView: React.FC = () => {
  const { role, addTicket, updateTicket, tickets } = useApp();
  const [tab, setTab] = useState<'OCCUPIED' | 'REPORT'>('OCCUPIED');
  const [toast, setToast] = useState<string>('');

  // Form state (Recepción)
  const [room, setRoom] = useState(ROOMS[0].number);
  const [asset, setAsset] = useState(ASSETS[0]);
  const [issue, setIssue] = useState(ISSUE_TYPES[0]);
  const [urgency, setUrgency] = useState<Urgency>(Urgency.MEDIUM);
  const [impact, setImpact] = useState<Impact>(Impact.ANNOYING);
  const [desc, setDesc] = useState('');

  const occupiedActive = useMemo(() => {
    return [...tickets]
      .filter(t => t.isOccupied && t.status !== TicketStatus.VERIFIED)
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [tickets]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    addTicket({
      roomNumber: room,
      isOccupied: true,
      asset,
      issueType: issue,
      urgency,
      impact,
      description: desc.trim(),
      createdBy: Role.RECEPTION,
      notes: [],
      needsPart: false,
      needsVendor: false
    });
    setDesc('');
    setToast(`Reporte creado para Habitación ${room}`);
    setTimeout(() => setToast(''), 2500);
    setTab('OCCUPIED');
  };

  const handleEscalateCritical = (t: Ticket) => {
    updateTicket(
      t.id,
      { urgency: Urgency.HIGH, impact: Impact.BLOCKING, isOccupied: true },
      'Escalada por Recepción: marcado como crítico (DEMO)'
    );
    setToast(`Ticket ${t.id} escalado a crítico`);
    setTimeout(() => setToast(''), 2000);
  };

  const handleCopy = async (t: Ticket) => {
    const ok = await copyToClipboard(guestMessage(t));
    setToast(ok ? 'Mensaje copiado' : 'No se pudo copiar');
    setTimeout(() => setToast(''), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Recepción</h2>
          <p className="text-slate-500">Gestión de incidencias reportadas por huésped (DEMO).</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTab('OCCUPIED')}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              tab === 'OCCUPIED'
                ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            <ListChecks className="w-4 h-4 inline-block mr-2" />
            Ocupadas con incidencias
          </button>
          <button
            onClick={() => setTab('REPORT')}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              tab === 'REPORT'
                ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            <PlusCircle className="w-4 h-4 inline-block mr-2" />
            Reportar huésped
          </button>
        </div>
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-lg text-sm">
          {toast}
        </div>
      )}

      {tab === 'OCCUPIED' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquareText className="w-5 h-5 text-slate-400" />
              <h3 className="font-bold text-slate-800">Habitaciones ocupadas con incidencias</h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Mensajes y ETA marcados como <span className="font-semibold">Estimación DEMO</span>.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {occupiedActive.length === 0 && (
              <div className="px-6 py-10 text-center text-slate-500 text-sm">
                No hay incidencias activas en habitaciones ocupadas.
              </div>
            )}

            {occupiedActive.map(t => (
              <div key={t.id} className="px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400">{t.id}</span>
                      <span className="text-[10px] uppercase bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold">
                        OCUPADA
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(t.status)}`}>
                        {t.status}
                      </span>
                      <span className={`text-xs ${getUrgencyColor(t.urgency)}`}>{t.urgency}</span>
                    </div>

                    <div className="text-lg font-bold text-slate-900">
                      Hab {t.roomNumber} <span className="text-sm font-normal text-slate-500">· {t.asset}</span>
                    </div>

                    <p className="text-sm text-slate-600 mt-1">{t.description}</p>

                    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="text-[11px] text-slate-500 mb-1">Mensaje sugerido al huésped (DEMO)</div>
                      <div className="text-sm text-slate-800 leading-snug">{guestMessage(t)}</div>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-400">
                      Origen: <span className="font-semibold">{t.createdBy}</span> · Impacto: <span className="font-semibold">{t.impact}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <Button variant="secondary" size="sm" onClick={() => handleCopy(t)}>
                      <Copy className="w-4 h-4 mr-2" /> Copiar mensaje
                    </Button>

                    {(t.urgency !== Urgency.HIGH || t.impact !== Impact.BLOCKING) && (
                      <Button variant="danger" size="sm" onClick={() => handleEscalateCritical(t)}>
                        <AlertTriangle className="w-4 h-4 mr-2" /> Escalar a crítico
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'REPORT' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-800">Nuevo reporte por huésped — {role}</h3>
            <p className="text-xs text-slate-500">Crea un ticket vinculado a habitación/activo/incidencia (DEMO).</p>
          </div>

          <form onSubmit={handleCreate} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Habitación (ocupada)</label>
                <select
                  className="w-full bg-white text-slate-900 border-slate-300 rounded-md shadow-sm focus:border-slate-500 focus:ring-slate-500 py-2 border px-3"
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                >
                  {ROOMS.map(r => (
                    <option key={r.number} value={r.number}>
                      {r.number} ({r.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <div className="w-full bg-rose-50 border border-rose-200 px-4 py-2 rounded-md">
                  <div className="text-xs font-bold text-rose-700">Ocupación</div>
                  <div className="text-sm text-rose-700">Este flujo crea tickets marcados como “Ocupada”.</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Activo / Categoría</label>
                <select
                  className="w-full bg-white text-slate-900 border-slate-300 rounded-md shadow-sm focus:border-slate-500 focus:ring-slate-500 py-2 border px-3"
                  value={asset}
                  onChange={e => setAsset(e.target.value)}
                >
                  {ASSETS.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Problema</label>
                <select
                  className="w-full bg-white text-slate-900 border-slate-300 rounded-md shadow-sm focus:border-slate-500 focus:ring-slate-500 py-2 border px-3"
                  value={issue}
                  onChange={e => setIssue(e.target.value)}
                >
                  {ISSUE_TYPES.map(i => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Urgencia</label>
                <div className="flex gap-2">
                  {[Urgency.LOW, Urgency.MEDIUM, Urgency.HIGH].map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgency(u)}
                      className={`flex-1 py-2 text-sm rounded-md border ${
                        urgency === u
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Impacto huésped</label>
                <div className="flex gap-2">
                  {[Impact.NONE, Impact.ANNOYING, Impact.BLOCKING].map(i => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setImpact(i)}
                      className={`flex-1 py-2 text-xs rounded-md border ${
                        impact === i
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción / queja del huésped</label>
              <textarea
                className="w-full bg-white text-slate-900 border-slate-300 rounded-md shadow-sm focus:border-slate-500 focus:ring-slate-500 py-2 border px-3"
                rows={3}
                placeholder="Ej. ‘No enciende el aire, el huésped reporta calor y no puede dormir’"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                required
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button type="submit" size="lg" className="w-full md:w-auto">
                Crear ticket (Recepción)
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
