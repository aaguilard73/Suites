import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { Impact, Ticket, TicketStatus, Urgency } from '../types';
import { ROOMS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  ArrowUpRight,
  AlertCircle,
  ShoppingBag,
  Users,
  Clock,
  CheckCircle,
  Home,
  ChevronRight,
  PlayCircle,
  Sparkles,
  Flame,
  Repeat,
  X,
  ChevronLeft,
  Package,
  ClipboardList,
  Minus,
  Plus,
  FileText,
  ShieldCheck,
  BadgeCheck
} from 'lucide-react';
import { getStatusColor, getUrgencyColor } from '../utils';

// ===============================
// INVENTARIO (DEMO LOCAL)
// ===============================

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  min: number;
  reorderTo: number;
  location?: string;
  updatedAt?: string;
};

type POItem = { partId: string; name: string; qty: number };

type PurchaseOrder = {
  id: string;
  createdAt: string;
  status: 'BORRADOR' | 'ENVIADA' | 'RECIBIDA';
  items: POItem[];
  notes?: string;
};

const INVENTORY_STORAGE_KEY = 'metodiko_demo_inventory_v1';
const PO_STORAGE_KEY = 'metodiko_demo_purchase_orders_v1';

const normalizePart = (s: string) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const DEFAULT_INVENTORY: InventoryItem[] = [
  {
    id: 'P-001',
    name: 'Outlet Universal Premium Blanco',
    unit: 'pza',
    onHand: 0,
    min: 2,
    reorderTo: 6,
    location: 'Almacén',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'P-002',
    name: 'Empaque lavabo (universal)',
    unit: 'pza',
    onHand: 12,
    min: 5,
    reorderTo: 20,
    location: 'Almacén',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'P-003',
    name: 'Capacitor HVAC 35uF',
    unit: 'pza',
    onHand: 1,
    min: 2,
    reorderTo: 6,
    location: 'Almacén',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'P-004',
    name: 'Baterías AA (Pack)',
    unit: 'pack',
    onHand: 3,
    min: 2,
    reorderTo: 8,
    location: 'Recepción',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'P-005',
    name: 'Filtro AC (standard)',
    unit: 'pza',
    onHand: 0,
    min: 4,
    reorderTo: 12,
    location: 'Almacén',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'P-006',
    name: 'Cable HDMI 2m',
    unit: 'pza',
    onHand: 5,
    min: 2,
    reorderTo: 10,
    location: 'Almacén',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'P-007',
    name: 'Silicón sanitario',
    unit: 'tubo',
    onHand: 1,
    min: 2,
    reorderTo: 6,
    location: 'Almacén',
    updatedAt: new Date().toISOString()
  }
];

const stockBadge = (onHand: number, min: number) => {
  if (onHand <= 0) {
    return {
      label: 'SIN STOCK',
      cls: 'bg-rose-100 text-rose-800 border-rose-200'
    };
  }
  if (onHand <= min) {
    return {
      label: 'BAJO',
      cls: 'bg-amber-100 text-amber-800 border-amber-200'
    };
  }
  return {
    label: 'OK',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  };
};

const suggestedReorder = (item: InventoryItem) => {
  if (item.onHand <= 0) return Math.max(0, item.reorderTo);
  if (item.onHand <= item.min) return Math.max(0, item.reorderTo - item.onHand);
  return 0;
};

const nextPOId = (existing: PurchaseOrder[]) => {
  const max = existing.reduce((m, po) => {
    const n = parseInt(String(po.id).replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 2000);
  return `PO-${max + 1}`;
};

// ===============================
// UI
// ===============================

const KPICard: React.FC<{ title: string; value: string | number; sub?: string; icon: React.ReactNode; active?: boolean }> = ({
  title,
  value,
  sub,
  icon,
  active
}) => (
  <div
    className={`p-6 rounded-xl border transition-all ${
      active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'
    }`}
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-lg ${active ? 'bg-slate-800' : 'bg-slate-50'}`}>{icon}</div>
      {sub && <span className="text-xs font-medium text-slate-400">{sub}</span>}
    </div>
    <div className="text-3xl font-bold mb-1">{value}</div>
    <div className={`text-sm font-medium ${active ? 'text-slate-300' : 'text-slate-500'}`}>{title}</div>
  </div>
);

const Pill: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${
      className || ''
    }`}
  >
    {children}
  </span>
);

const SectionCard: React.FC<{
  id?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, title, subtitle, icon, right, children }) => (
  <div id={id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h3 className="font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const daysBetween = (iso: string) => {
  const d = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - d) / (1000 * 3600 * 24)));
};

const withinDays = (iso: string, days: number) => {
  const t = new Date(iso).getTime();
  return Date.now() - t <= days * 24 * 3600 * 1000;
};

const isCriticalTicket = (t: Ticket) => t.urgency === Urgency.HIGH || t.impact === Impact.BLOCKING;
const isPendingTicket = (t: Ticket) => t.status !== TicketStatus.VERIFIED;

const getVerifiedDate = (t: Ticket): Date | null => {
  if (t.closedAt) return new Date(t.closedAt);
  const ev = [...t.history].reverse().find(h => (h.action || '').toLowerCase().includes('verific'));
  return ev ? new Date(ev.date) : null;
};

const withinLastDays = (d: Date, days: number) => {
  const diff = Date.now() - d.getTime();
  return diff <= days * 24 * 3600 * 1000;
};

type TourStep = {
  targetId: string;
  title: string;
  body: string;
  action?: 'OPEN_TOP_TICKET' | 'SWITCH_TO_BUY' | 'SCROLL_TO_INVENTORY';
};

const computeTooltipPos = (rect: { top: number; left: number; width: number; height: number }) => {
  const pad = 16;
  const w = 392;
  const h = 190;

  let left = Math.min(window.innerWidth - w - pad, Math.max(pad, rect.left));
  let top = rect.top + rect.height + 12;

  if (top + h > window.innerHeight - pad) {
    top = Math.max(pad, rect.top - h - 12);
  }
  return { left, top, w };
};

const TourOverlay: React.FC<{
  active: boolean;
  stepIndex: number;
  steps: TourStep[];
  highlight: { top: number; left: number; width: number; height: number } | null;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
}> = ({ active, stepIndex, steps, highlight, onNext, onPrev, onExit }) => {
  if (!active || !highlight) return null;

  const step = steps[stepIndex];
  const tip = computeTooltipPos(highlight);

  return (
    <div className="fixed inset-0 z-[95]">
      <div
        style={{
          position: 'fixed',
          top: highlight.top - 8,
          left: highlight.left - 8,
          width: highlight.width + 16,
          height: highlight.height + 16,
          borderRadius: 18,
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65)',
          border: '2px solid rgba(255,255,255,0.70)'
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: tip.top,
          left: tip.left,
          width: tip.w
        }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">
              DEMO GUIADA • {stepIndex + 1}/{steps.length}
            </div>
            <div className="text-sm font-bold text-slate-900">{step.title}</div>
          </div>
          <button onClick={onExit} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 text-sm text-slate-700 leading-snug">{step.body}</div>

        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onPrev}
            disabled={stepIndex === 0}
            className={`text-sm font-medium inline-flex items-center gap-2 ${
              stepIndex === 0 ? 'text-slate-300' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          <button
            onClick={onNext}
            className="text-sm font-semibold inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800"
          >
            {stepIndex === steps.length - 1 ? 'Finalizar' : 'Siguiente'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const RoomMap: React.FC<{
  tickets: Ticket[];
  onSelectRoom: (room: string) => void;
  roomHot: Record<string, boolean>;
  roomRecurrent: Record<string, boolean>;
}> = ({ tickets, onSelectRoom, roomHot, roomRecurrent }) => {
  const roomState = useMemo(() => {
    const map: Record<string, { state: 'OK' | 'PENDING' | 'CRITICAL'; occupied: boolean; count: number }> = {};
    ROOMS.forEach(r => {
      const active = tickets.filter(t => t.roomNumber === r.number && t.status !== TicketStatus.VERIFIED);
      const occupied = active.some(t => t.isOccupied);
      const critical = active.some(isCriticalTicket);
      const state: 'OK' | 'PENDING' | 'CRITICAL' = active.length === 0 ? 'OK' : critical ? 'CRITICAL' : 'PENDING';
      map[r.number] = { state, occupied, count: active.length };
    });
    return map;
  }, [tickets]);

  const badgeClass = (state: string) => {
    if (state === 'CRITICAL') return 'bg-rose-100 border-rose-200 text-rose-800';
    if (state === 'PENDING') return 'bg-amber-50 border-amber-200 text-amber-800';
    return 'bg-emerald-50 border-emerald-200 text-emerald-800';
  };

  return (
    <div id="room-map-section" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="w-5 h-5 text-slate-400" />
          <h3 className="font-bold text-slate-800">Mapa de habitaciones (DEMO)</h3>
        </div>
        <div className="text-[11px] text-slate-400">Click en una habitación para ver incidencias activas.</div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {ROOMS.map(r => {
            const s = roomState[r.number];
            const hot = !!roomHot[r.number];
            const rec = !!roomRecurrent[r.number];

            return (
              <button
                key={r.number}
                onClick={() => onSelectRoom(r.number)}
                className={`relative rounded-lg border px-2 py-3 text-left transition-all hover:shadow-sm ${badgeClass(s.state)}`}
                title={`Hab ${r.number} — ${s.state} — ${s.count} ticket(s)`}
              >
                <div className="text-sm font-bold">{r.number}</div>
                <div className="text-[10px] font-medium opacity-80">
                  {s.state === 'OK' ? 'OK' : s.state === 'CRITICAL' ? 'Crítica' : 'Pendiente'}
                </div>

                {s.occupied && (
                  <span className="absolute top-1 right-1 text-[9px] uppercase bg-rose-500 text-white px-1.5 py-0.5 rounded font-bold">
                    OC
                  </span>
                )}

                {hot && (
                  <span className="absolute bottom-1 left-1 text-[9px] uppercase bg-slate-900 text-white px-1.5 py-0.5 rounded font-bold">
                    HOT
                  </span>
                )}

                {rec && (
                  <span className="absolute bottom-1 right-1 text-[9px] uppercase bg-white/80 border border-white/70 text-slate-900 px-1.5 py-0.5 rounded font-bold">
                    R
                  </span>
                )}

                {s.count > 0 && (
                  <span className="absolute top-1 left-1 text-[10px] bg-white/70 border border-white/60 rounded px-1.5 py-0.5 font-bold">
                    {s.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 text-[11px] text-slate-400 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200 inline-block" /> OK
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" /> Pendiente
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-rose-100 border border-rose-200 inline-block" /> Crítica
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-bold">OC</span> Ocupada
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-bold">HOT</span> Hotspot (7 días)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-white border text-slate-900 text-[9px] font-bold">R</span> Recurrente
          </span>
        </div>
      </div>
    </div>
  );
};

const RoomTicketsModal: React.FC<{
  room: string | null;
  tickets: Ticket[];
  onClose: () => void;
  onOpenTicket: (t: Ticket) => void;
  roomHot: boolean;
  roomRecurrent: boolean;
  recurrentKeyCount: Record<string, number>;
}> = ({ room, tickets, onClose, onOpenTicket, roomHot, roomRecurrent, recurrentKeyCount }) => {
  if (!room) return null;

  const roomTickets = tickets
    .filter(t => t.roomNumber === room && t.status !== TicketStatus.VERIFIED)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const isRec = (t: Ticket) => {
    const key = `${t.roomNumber}|${t.asset}`;
    return (recurrentKeyCount[key] || 0) > 1;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Habitación {room}</h3>
            <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-2">
              <span className="text-[11px]">Incidencias activas (DEMO)</span>
              {roomHot && (
                <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full">HOTSPOT 7D</span>
              )}
              {roomRecurrent && (
                <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-900 px-2 py-0.5 rounded-full">
                  RECURRENTE
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-3">
          {roomTickets.length === 0 && <div className="text-sm text-slate-500">Sin incidencias activas.</div>}

          {roomTickets.map(t => (
            <button
              key={t.id}
              onClick={() => onOpenTicket(t)}
              className="w-full text-left p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                    {t.id}
                    {isRec(t) && (
                      <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-900 px-2 py-0.5 rounded-full">
                        Recurrente
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900">
                    {t.asset} · {t.issueType}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{t.description}</div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Prioridad: <span className="font-bold text-slate-700">{t.priorityScore}</span> · Antigüedad:{' '}
                    <span className="font-semibold">{daysBetween(t.createdAt)} día(s)</span> · Origen:{' '}
                    <span className="font-semibold">{t.createdBy}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(t.status)}`}>{t.status}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const TicketDetailModal: React.FC<{
  ticket: Ticket | null;
  onClose: () => void;
  isRecurrent: boolean;
  isHotspotRoom: boolean;
}> = ({ ticket, onClose, isRecurrent, isHotspotRoom }) => {
  if (!ticket) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div id="ticket-detail-modal" className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex justify-between items-start">
          <div>
            <div className="text-xs font-mono text-slate-400">{ticket.id}</div>
            <h3 className="text-2xl font-bold text-slate-900">Hab {ticket.roomNumber}</h3>
            <div className="text-sm text-slate-500 mt-1">
              {ticket.asset} — {ticket.issueType}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {isHotspotRoom && (
                <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full">HOTSPOT 7D</span>
              )}
              {isRecurrent && (
                <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-900 px-2 py-0.5 rounded-full">
                  RECURRENTE
                </span>
              )}
              {ticket.isOccupied && (
                <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full">OCUPADA</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Resumen</div>
              <div className="text-sm text-slate-700">
                <span className="font-semibold">Estado:</span>{' '}
                <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] ${getStatusColor(ticket.status)}`}>
                  {ticket.status}
                </span>
              </div>
              <div className="text-sm text-slate-700 mt-2">
                <span className="font-semibold">Prioridad:</span> {ticket.priorityScore}
              </div>
              <div className="text-sm text-slate-700 mt-2">
                <span className="font-semibold">Urgencia:</span>{' '}
                <span className={getUrgencyColor(ticket.urgency)}>{ticket.urgency}</span>
              </div>
              <div className="text-sm text-slate-700 mt-2">
                <span className="font-semibold">Impacto:</span> {ticket.impact}
              </div>
              <div className="text-sm text-slate-700 mt-2">
                <span className="font-semibold">Origen:</span> {ticket.createdBy}
              </div>
              <div className="text-sm text-slate-700 mt-2">
                <span className="font-semibold">Antigüedad:</span> {daysBetween(ticket.createdAt)} día(s)
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Descripción</div>
              <div className="text-sm text-slate-700">{ticket.description}</div>

              {(ticket.needsPart || ticket.needsVendor) && (
                <div className="mt-4 space-y-2">
                  {ticket.needsPart && (
                    <div className="text-sm text-amber-700 font-semibold">Refacción: {ticket.partName || 'Pendiente (DEMO)'}</div>
                  )}
                  {ticket.needsVendor && (
                    <div className="text-sm text-purple-700 font-semibold">Proveedor: {ticket.vendorType || 'Pendiente (DEMO)'}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Audit log (DEMO)</div>
            <div className="border-l-2 border-slate-200 pl-4 space-y-4 max-h-64 overflow-y-auto">
              {ticket.history.map((h, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white" />
                  <p className="text-xs text-slate-500 mb-0.5">
                    {new Date(h.date).toLocaleString()} <span className="text-slate-300">•</span> {h.user}
                  </p>
                  <p className="text-sm font-medium text-slate-800">{h.action}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            *Este detalle muestra trazabilidad (quién hizo qué y cuándo). Datos simulados (DEMO).
          </div>
        </div>
      </div>
    </div>
  );
};

// ===============================
// INVENTARIO PANEL + PO MODAL
// ===============================

const InventoryRow: React.FC<{
  item: InventoryItem;
  linkedTickets: Ticket[];
  onAdjust: (delta: number) => void;
  onReceiveToReorder: () => void;
  onQuickConsume: () => void;
}> = ({ item, linkedTickets, onAdjust, onReceiveToReorder, onQuickConsume }) => {
  const badge = stockBadge(item.onHand, item.min);
  const reco = suggestedReorder(item);

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-900">{item.name}</div>
        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
          <span className="font-mono">{item.id}</span>
          <span className="text-slate-300">•</span>
          <span>
            Ubicación: <span className="font-semibold text-slate-500">{item.location || '—'}</span>
          </span>
        </div>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <Pill className={badge.cls}>{badge.label}</Pill>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-sm text-slate-700">
          <span className="font-bold text-slate-900">{item.onHand}</span> <span className="text-slate-400">{item.unit}</span>
        </div>
        <div className="text-[11px] text-slate-400">Mín: {item.min} · Reordenar a: {item.reorderTo}</div>
      </td>

      <td className="px-4 py-3">
        {linkedTickets.length === 0 ? (
          <div className="text-sm text-slate-400">—</div>
        ) : (
          <div className="space-y-1">
            {linkedTickets.slice(0, 3).map(t => (
              <div key={t.id} className="text-[11px]">
                <span className="font-mono text-slate-400">{t.id}</span>
                <span className="text-slate-300"> · </span>
                <span className="font-semibold text-slate-700">Hab {t.roomNumber}</span>
                <span className="text-slate-300"> · </span>
                <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${getStatusColor(t.status)}`}>{t.status}</span>
              </div>
            ))}
            {linkedTickets.length > 3 && <div className="text-[11px] text-slate-400">+{linkedTickets.length - 3} más</div>}
          </div>
        )}
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAdjust(-1)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            title="Ajustar -1"
          >
            <Minus className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => onAdjust(+1)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            title="Ajustar +1"
          >
            <Plus className="w-4 h-4 text-slate-600" />
          </button>

          <button
            onClick={onQuickConsume}
            disabled={item.onHand <= 0}
            className={`inline-flex items-center gap-2 px-3 h-9 rounded-lg border text-xs font-semibold ${
              item.onHand <= 0
                ? 'bg-slate-50 border-slate-200 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Simular consumo por uso en reparación"
          >
            <ClipboardList className="w-4 h-4" /> Consumir
          </button>

          <button
            onClick={onReceiveToReorder}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
            title="Simular recepción de compra (reponer a nivel objetivo)"
          >
            <Package className="w-4 h-4" /> Recibir
            {reco > 0 && <span className="ml-1 bg-white/15 px-2 py-0.5 rounded-full">+{reco}</span>}
          </button>
        </div>
      </td>
    </tr>
  );
};

const PurchaseOrderModal: React.FC<{
  open: boolean;
  onClose: () => void;
  po: PurchaseOrder | null;
}> = ({ open, onClose, po }) => {
  if (!open || !po) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-slate-400">{po.id}</div>
            <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Orden de Compra (DEMO)
              <Pill className="bg-slate-100 text-slate-800 border-slate-200">{po.status}</Pill>
            </div>
            <div className="text-sm text-slate-500 mt-1">Generada: {new Date(po.createdAt).toLocaleString()}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase mb-3">Detalle</div>
            <div className="space-y-2">
              {po.items.map(it => (
                <div key={it.partId} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{it.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{it.partId}</div>
                  </div>
                  <div className="text-lg font-bold text-slate-900">{it.qty}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Uso</div>
              <div className="text-sm text-slate-600">Refacciones ligadas a tickets “Espera refacción”.</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Control</div>
              <div className="text-sm text-slate-600">Evidencia “qué comprar” con criterio (stock vs mínimo).</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Trazabilidad</div>
              <div className="text-sm text-slate-600">Registro local (DEMO) — no integra ERP.</div>
            </div>
          </div>

          <div className="mt-4 text-[11px] text-slate-400">
            *DEMO: la OC es una representación para explicar flujo y decisiones. La implementación real define catálogo, responsables y aprobación.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            Cerrar
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            <FileText className="w-4 h-4" /> Imprimir (DEMO)
          </button>
        </div>
      </div>
    </div>
  );
};

// ===============================
// MAIN VIEW
// ===============================

export const ManagementView: React.FC = () => {
  const { tickets, exportCSV, runScenario } = useApp();

  const [tab, setTab] = useState<'PRIORITY' | 'BUY' | 'VENDOR'>('PRIORITY');

  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [toast, setToast] = useState<string>('');
  const [focusTicketId, setFocusTicketId] = useState<string | null>(null);

  // INVENTARIO (local)
  const [inventory, setInventory] = useState<InventoryItem[]>(DEFAULT_INVENTORY);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [activePO, setActivePO] = useState<PurchaseOrder | null>(null);

  // TOUR
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [highlight, setHighlight] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const tourRef = useRef<{ steps: TourStep[] }>({ steps: [] });

  // --- TOUR: refs para mantener highlight estable durante scroll/resize ---
  const highlightTargetIdRef = useRef<string | null>(null);
  const tourActiveRef = useRef<boolean>(false);

  useEffect(() => {
    tourActiveRef.current = tourActive;
  }, [tourActive]);

  const measureHighlight = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setHighlight({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  const scrollAndHighlight = (targetId: string, attempt = 0) => {
    const el = document.getElementById(targetId) as HTMLElement | null;
    if (!el) {
      if (attempt < 40) window.setTimeout(() => scrollAndHighlight(targetId, attempt + 1), 50);
      return;
    }

    highlightTargetIdRef.current = targetId;

    // 1) scroll primero
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      // ignore
    }

    // 2) re-medir por una ventana corta (mientras el smooth scroll "se asienta")
    const start = performance.now();
    const tick = () => {
      if (!tourActiveRef.current) return;
      const node = document.getElementById(targetId) as HTMLElement | null;
      if (node) measureHighlight(node);
      if (performance.now() - start < 650) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  };

  // Mantener highlight alineado si el usuario hace scroll/resize durante el tour
  useEffect(() => {
    if (!tourActive) return;

    const sync = () => {
      const id = highlightTargetIdRef.current;
      if (!id) return;
      const el = document.getElementById(id) as HTMLElement | null;
      if (!el) return;
      measureHighlight(el);
    };

    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [tourActive]);

  // Load inventory + POs
  useEffect(() => {
    const inv = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (inv) {
      try {
        const parsed: InventoryItem[] = JSON.parse(inv);
        if (Array.isArray(parsed) && parsed.length) setInventory(parsed);
      } catch {
        // ignore
      }
    }

    const pos = localStorage.getItem(PO_STORAGE_KEY);
    if (pos) {
      try {
        const parsed: PurchaseOrder[] = JSON.parse(pos);
        if (Array.isArray(parsed)) setPurchaseOrders(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem(PO_STORAGE_KEY, JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  // ---------- Recurrente / Hotspots ----------
  const recurrentKeyCount = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      if (!withinDays(t.createdAt, 30)) return;
      const key = `${t.roomNumber}|${t.asset}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [tickets]);

  const roomCount7d = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      if (!withinDays(t.createdAt, 7)) return;
      counts[t.roomNumber] = (counts[t.roomNumber] || 0) + 1;
    });
    return counts;
  }, [tickets]);

  const roomHot = useMemo(() => {
    const hot: Record<string, boolean> = {};
    ROOMS.forEach(r => {
      hot[r.number] = (roomCount7d[r.number] || 0) >= 3;
    });
    return hot;
  }, [roomCount7d]);

  const roomRecurrent = useMemo(() => {
    const rec: Record<string, boolean> = {};
    ROOMS.forEach(r => {
      const active = tickets.filter(t => t.roomNumber === r.number && t.status !== TicketStatus.VERIFIED);
      rec[r.number] = active.some(t => (recurrentKeyCount[`${t.roomNumber}|${t.asset}`] || 0) > 1);
    });
    return rec;
  }, [tickets, recurrentKeyCount]);

  const isTicketRecurrent = (t: Ticket) => (recurrentKeyCount[`${t.roomNumber}|${t.asset}`] || 0) > 1;
  const isRoomHotspot = (room: string) => !!roomHot[room];

  // ---------- KPIs ----------
  const pendingTickets = tickets.filter(isPendingTicket);
  const pendingCount = pendingTickets.length;
  const criticalCount = pendingTickets.filter(isCriticalTicket).length;
  const blockedCount = tickets.filter(t => t.status === TicketStatus.WAITING_PART || t.status === TicketStatus.VENDOR).length;
  const closed7d = tickets
    .filter(t => {
      if (t.status !== TicketStatus.VERIFIED) return false;
      const d = getVerifiedDate(t);
      return d ? withinLastDays(d, 7) : false;
    })
    .length;

  // ---------- Decision Support ----------
  const topPriority = useMemo(() => {
    return [...tickets]
      .filter(t => t.status !== TicketStatus.VERIFIED)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 5);
  }, [tickets]);

  const partsNeeded = useMemo(() => {
    return tickets.filter(t => t.needsPart && t.status !== TicketStatus.VERIFIED);
  }, [tickets]);

  const vendorNeeded = useMemo(() => {
    return tickets.filter(t => t.needsVendor && t.status !== TicketStatus.VERIFIED);
  }, [tickets]);

  // Recepción (visible a Marc): habitaciones ocupadas en riesgo
  const guestRisk = useMemo(() => {
    return tickets
      .filter(t => t.status !== TicketStatus.VERIFIED)
      .filter(t => t.isOccupied)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 6);
  }, [tickets]);

  // Staffing estimation (DEMO)
  const actionable = tickets.filter(t => [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED].includes(t.status)).length;
  const morningLoad = Math.max(1, Math.ceil((actionable * 0.6) / 4));
  const eveningLoad = Math.max(1, Math.ceil((actionable * 0.4) / 4));

  // Chart: issues by asset
  const assetData = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      counts[t.asset] = (counts[t.asset] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [tickets]);

  // ---------- Enfoque automático al ticket después de escenarios DEMO ----------
  useEffect(() => {
    if (!focusTicketId) return;
    const t = tickets.find(x => x.id === focusTicketId);
    if (t) {
      setSelectedTicket(t);
      setFocusTicketId(null);
    }
  }, [tickets, focusTicketId]);

  const fireToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout((fireToast as any)._t);
    (fireToast as any)._t = window.setTimeout(() => setToast(''), 2200);
  };

  const handleScenario = (type: 'GUEST_COMPLAINT' | 'CLEANING_REPORT' | 'BLOCK_PART' | 'BLOCK_VENDOR') => {
    const id = runScenario(type);
    if (type === 'GUEST_COMPLAINT') fireToast('Escenario DEMO: queja de huésped (ocupada) creada');
    if (type === 'CLEANING_REPORT') fireToast('Escenario DEMO: reporte de limpieza creado');
    if (type === 'BLOCK_PART') fireToast('Escenario DEMO: ticket marcado “Espera refacción”');
    if (type === 'BLOCK_VENDOR') fireToast('Escenario DEMO: ticket marcado “Requiere proveedor”');
    if (id) setFocusTicketId(id);
  };

  // ---------- INVENTARIO: vincular tickets ↔ refacciones ----------
  const inventoryIndex = useMemo(() => {
    const map: Record<string, InventoryItem> = {};
    inventory.forEach(i => (map[normalizePart(i.name)] = i));
    return map;
  }, [inventory]);

  const partToTickets = useMemo(() => {
    const map: Record<string, Ticket[]> = {};
    tickets
      .filter(t => t.needsPart && t.status !== TicketStatus.VERIFIED)
      .forEach(t => {
        const part = normalizePart(t.partName || '');
        if (!part) return;
        map[part] = map[part] || [];
        map[part].push(t);
      });

    Object.keys(map).forEach(k => {
      map[k] = map[k].sort((a, b) => b.priorityScore - a.priorityScore);
    });

    return map;
  }, [tickets]);

  const inventoryKPIs = useMemo(() => {
    const outOfStock = inventory.filter(i => i.onHand <= 0);
    const low = inventory.filter(i => i.onHand > 0 && i.onHand <= i.min);

    // Items ligados a tickets (por refacción) + riesgo si stock insuficiente
    const linked = Object.keys(partToTickets).map(key => {
      const inv = inventoryIndex[key];
      const list = partToTickets[key];
      return { key, inv, list };
    });

    const missingCatalog = linked.filter(x => !x.inv);
    const blockedByStock = linked.filter(x => x.inv).filter(x => (x.inv as InventoryItem).onHand <= 0);

    return {
      outOfStock,
      low,
      linked,
      missingCatalog,
      blockedByStock
    };
  }, [inventory, inventoryIndex, partToTickets]);

  const createSuggestedPO = () => {
    // Regla DEMO: incluir todo SIN STOCK + BAJO (hasta reorderTo)
    const candidates = [...inventory]
      .map(it => ({ it, qty: suggestedReorder(it) }))
      .filter(x => x.qty > 0);

    if (candidates.length === 0) {
      fireToast('Inventario: no hay sugerencias de compra (todo OK)');
      return;
    }

    const po: PurchaseOrder = {
      id: nextPOId(purchaseOrders),
      createdAt: new Date().toISOString(),
      status: 'BORRADOR',
      items: candidates.map(x => ({ partId: x.it.id, name: x.it.name, qty: x.qty })),
      notes: 'DEMO: generado por regla stock vs mínimo.'
    };

    setPurchaseOrders(prev => [po, ...prev]);
    setActivePO(po);
    setPoModalOpen(true);
    fireToast('OC (DEMO) generada a partir de stock vs mínimo');
  };

  const adjustInventory = (id: string, delta: number) => {
    setInventory(prev =>
      prev.map(it =>
        it.id === id
          ? {
              ...it,
              onHand: Math.max(0, it.onHand + delta),
              updatedAt: new Date().toISOString()
            }
          : it
      )
    );
  };

  const receiveToReorder = (id: string) => {
    setInventory(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const qty = suggestedReorder(it);
        if (qty <= 0) return it;
        return {
          ...it,
          onHand: it.onHand + qty,
          updatedAt: new Date().toISOString()
        };
      })
    );
  };

  const consumeOne = (id: string) => {
    setInventory(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        return {
          ...it,
          onHand: Math.max(0, it.onHand - 1),
          updatedAt: new Date().toISOString()
        };
      })
    );
  };

  const resetInventory = () => {
    localStorage.removeItem(INVENTORY_STORAGE_KEY);
    setInventory(DEFAULT_INVENTORY);
    fireToast('Inventario DEMO reiniciado');
  };

  // ---------- TOUR 60s ----------
  const steps: TourStep[] = useMemo(
    () => [
      {
        targetId: 'kpi-section',
        title: 'KPIs en 5 segundos',
        body: 'Marc ve volumen de pendientes, criticidad, bloqueos (refacción/proveedor) y cierres recientes (7 días).'
      },
      {
        targetId: 'guest-risk-section',
        title: 'Recepción: huéspedes en riesgo',
        body: 'Habitaciones ocupadas con incidencias activas. Esto hace evidente dónde se afecta la experiencia del huésped.'
      },
      {
        targetId: 'room-map-section',
        title: 'Mapa por habitación (visual y accionable)',
        body: 'Click y ves incidencias activas por habitación. HOTSPOT (7 días) y RECURRENTE evidencian patrones.'
      },
      {
        targetId: 'decision-support-section',
        title: '¿Qué reparar primero?',
        body: 'Ranking por prioridad (urgencia/impacto/ocupación/antigüedad). Todo con trazabilidad (audit log).'
      },
      {
        targetId: 'ticket-detail-modal',
        title: 'Detalle de ticket + trazabilidad',
        body: 'Abrimos un ticket para ver el “por qué” y el “quién hizo qué y cuándo”.',
        action: 'OPEN_TOP_TICKET'
      },
      {
        targetId: 'decision-tabs',
        title: '¿Qué comprar / qué tercerizar?',
        body: 'Listas accionables derivadas de tickets marcados como refacción o proveedor.',
        action: 'SWITCH_TO_BUY'
      },
      {
        targetId: 'inventory-panel',
        title: 'Inventario: evidencia de “qué comprar”',
        body: 'Aquí se ve stock vs mínimo y se genera una OC (DEMO) para que Marc entienda el output.',
        action: 'SCROLL_TO_INVENTORY'
      }
    ],
    []
  );

  tourRef.current.steps = steps;

  const exitTour = () => {
    setTourActive(false);
    setTourStep(0);
    setHighlight(null);
    highlightTargetIdRef.current = null;
    setSelectedTicket(null);
    setSelectedRoom(null);
  };

  const startTour = () => {
    setSelectedTicket(null);
    setSelectedRoom(null);
    setTab('PRIORITY');
    setTourStep(0);
    setTourActive(true);
    fireToast('Demo guiada iniciada (60s)');
  };

  useEffect(() => {
    if (!tourActive) return;

    const step = steps[tourStep];

    if (step.action === 'OPEN_TOP_TICKET') {
      const t = topPriority[0] || null;
      if (t) setSelectedTicket(t);
    }

    if (step.action === 'SWITCH_TO_BUY') {
      setTab('BUY');
    }

    if (step.action === 'SCROLL_TO_INVENTORY') {
      setTab('BUY');
    }

    window.setTimeout(() => scrollAndHighlight(step.targetId), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive, tourStep]);

  const nextTour = () => {
    if (tourStep >= steps.length - 1) {
      fireToast('Demo guiada finalizada');
      exitTour();
      return;
    }
    setTourStep(s => s + 1);
  };

  const prevTour = () => {
    setTourStep(s => Math.max(0, s - 1));
  };

  // ---------- BUY tab counts ----------
  const buyCount = partsNeeded.length;
  const vendorCount = vendorNeeded.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Vista Ejecutiva</h2>
          <p className="text-slate-500">Resumen operativo y soporte a decisiones (DEMO).</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={startTour}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            <PlayCircle className="w-4 h-4" /> Demo guiada (60s)
          </button>

          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            <ArrowUpRight className="w-4 h-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-lg text-sm">{toast}</div>}

      {/* Escenarios DEMO (WOW) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-slate-800">Escenarios DEMO (1-click)</h3>
          </div>
          <div className="text-[11px] text-slate-400">Demuestra el flujo completo sin teclear.</div>
        </div>

        <div className="p-6 flex flex-wrap gap-2">
          <button
            onClick={() => handleScenario('GUEST_COMPLAINT')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            <AlertCircle className="w-4 h-4" /> Simular queja huésped (ocupada)
          </button>

          <button
            onClick={() => handleScenario('CLEANING_REPORT')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            <Repeat className="w-4 h-4" /> Simular reporte limpieza
          </button>

          <button
            onClick={() => handleScenario('BLOCK_PART')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            <ShoppingBag className="w-4 h-4" /> Simular “Espera refacción”
          </button>

          <button
            onClick={() => handleScenario('BLOCK_VENDOR')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            <Flame className="w-4 h-4" /> Simular “Requiere proveedor”
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div id="kpi-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Pendientes (No verificados)" value={pendingCount} icon={<Clock className="w-5 h-5" />} active={pendingCount > 10} />
        <KPICard
          title="Críticos / Urgentes"
          value={criticalCount}
          sub="Atención inmediata"
          icon={<AlertCircle className={`w-5 h-5 ${criticalCount > 0 ? 'text-rose-500' : ''}`} />}
        />
        <KPICard title="Bloqueados (Refacción/Proveedor)" value={blockedCount} sub="Riesgo de retraso" icon={<ShoppingBag className="w-5 h-5" />} />
        <KPICard title="Cerrados (7 días)" value={closed7d} icon={<CheckCircle className="w-5 h-5 text-emerald-500" />} />
      </div>

      {/* Recepción: huéspedes en riesgo */}
      <SectionCard
        id="guest-risk-section"
        title="Recepción (visibilidad para Marc): Huéspedes en riesgo"
        subtitle="Habitaciones ocupadas con incidencias activas — esto hace tangible el impacto en experiencia del huésped."
        icon={<ShieldCheck className="w-5 h-5 text-slate-400" />}
        right={<div className="text-[11px] text-slate-400">*DEMO: prioriza por urgencia/impacto/antigüedad.</div>}
      >
        {guestRisk.length === 0 ? (
          <div className="text-sm text-slate-500">Sin incidencias activas en habitaciones ocupadas.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {guestRisk.map(t => (
              <button
                key={t.id}
                className="text-left p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                onClick={() => setSelectedTicket(t)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono text-slate-400">{t.id}</div>
                    <div className="font-bold text-slate-900">
                      Hab {t.roomNumber} · {t.asset}
                    </div>
                    <div className="text-sm text-slate-600 mt-1 line-clamp-2">{t.description}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill className={getStatusColor(t.status)}>{t.status}</Pill>
                      <Pill className="bg-white text-slate-700 border-slate-200">{t.urgency}</Pill>
                      <Pill className="bg-white text-slate-700 border-slate-200">{t.impact}</Pill>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">Prioridad</div>
                    <div className="text-2xl font-black text-slate-900">{t.priorityScore}</div>
                    <div className="text-[11px] text-slate-400">{daysBetween(t.createdAt)}d</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Room Map */}
      <RoomMap tickets={tickets} onSelectRoom={r => setSelectedRoom(r)} roomHot={roomHot} roomRecurrent={roomRecurrent} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left */}
        <div className="lg:col-span-2 space-y-6">
          {/* Decision Support */}
          <div id="decision-support-section" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold text-slate-800">Soporte a Decisiones</h3>
              </div>

              <div id="decision-tabs" className="flex gap-2">
                <button
                  onClick={() => setTab('PRIORITY')}
                  className={`text-sm px-3 py-1 rounded-full ${
                    tab === 'PRIORITY' ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ¿Qué reparar?
                </button>
                <button
                  onClick={() => setTab('BUY')}
                  className={`text-sm px-3 py-1 rounded-full ${
                    tab === 'BUY' ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ¿Qué comprar?
                  {buyCount > 0 && <span className="ml-2 text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-full">{buyCount}</span>}
                </button>
                <button
                  onClick={() => setTab('VENDOR')}
                  className={`text-sm px-3 py-1 rounded-full ${
                    tab === 'VENDOR' ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ¿Qué tercerizar?
                  {vendorCount > 0 && <span className="ml-2 text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-full">{vendorCount}</span>}
                </button>
              </div>
            </div>

            <div className="p-0">
              {tab === 'PRIORITY' && (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                    <tr>
                      <th className="px-6 py-3">Puntaje</th>
                      <th className="px-6 py-3">Habitación</th>
                      <th className="px-6 py-3">Incidencia</th>
                      <th className="px-6 py-3">Criterios (DEMO)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topPriority.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedTicket(t)}>
                        <td className="px-6 py-4 font-bold text-slate-900">{t.priorityScore}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900 flex items-center gap-2">
                            Hab {t.roomNumber}
                            {isRoomHotspot(t.roomNumber) && (
                              <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full">HOT</span>
                            )}
                            {isTicketRecurrent(t) && (
                              <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-900 px-2 py-0.5 rounded-full">
                                R
                              </span>
                            )}
                          </div>
                          {t.isOccupied && (
                            <span className="text-[10px] uppercase bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">Ocupada</span>
                          )}
                          <div className="text-[11px] text-slate-400 mt-1">{t.id}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          <span className="block text-slate-900 font-medium">{t.asset}</span>
                          {t.description}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          <div className="flex flex-wrap gap-2">
                            <span className={`px-2 py-0.5 rounded-full border ${getStatusColor(t.status)}`}>{t.status}</span>
                            <span className="px-2 py-0.5 rounded-full border bg-white text-slate-700">{t.urgency}</span>
                            <span className="px-2 py-0.5 rounded-full border bg-white text-slate-700">{t.impact}</span>
                            <span className="px-2 py-0.5 rounded-full border bg-white text-slate-700">
                              Antigüedad: {daysBetween(t.createdAt)}d
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'BUY' && (
                <div id="buy-panel" className="p-6 space-y-6">
                  {/* INVENTARIO (evidente) */}
                  <div id="inventory-panel">
                    <SectionCard
                      title="Inventario de refacciones (DEMO)"
                      subtitle="Stock vs mínimo + tickets ligados + OC (DEMO). En implementación real se carga catálogo y responsables."
                      icon={<Package className="w-5 h-5 text-slate-400" />}
                      right={
                        <div className="flex items-center gap-2">
                          <button
                            onClick={resetInventory}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                          >
                            Reiniciar
                          </button>
                          <button
                            onClick={createSuggestedPO}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                          >
                            <FileText className="w-4 h-4" /> Generar OC (DEMO)
                          </button>
                        </div>
                      }
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Sin stock</div>
                          <div className="text-3xl font-black text-slate-900">{inventoryKPIs.outOfStock.length}</div>
                          <div className="text-[11px] text-slate-400 mt-1">Items que bloquean reparaciones.</div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Bajo stock</div>
                          <div className="text-3xl font-black text-slate-900">{inventoryKPIs.low.length}</div>
                          <div className="text-[11px] text-slate-400 mt-1">Riesgo próximo (reordenar).</div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Tickets ligados</div>
                          <div className="text-3xl font-black text-slate-900">
                            {Object.values(partToTickets).reduce((a, b) => a + b.length, 0)}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">Refacción ↔ ticket (visible).</div>
                        </div>
                      </div>

                      {inventoryKPIs.missingCatalog.length > 0 && (
                        <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
                          <div className="font-bold">
                            Atención (DEMO): hay refacciones en tickets que aún no están en catálogo
                          </div>
                          <div className="text-[12px] mt-1">
                            Esto es exactamente el tipo de hallazgo que se corrige en la implementación: estandarizar nombres/catálogo.
                          </div>
                        </div>
                      )}

                      <div className="mt-6 overflow-x-auto">
                        <table className="min-w-full text-left">
                          <thead className="bg-slate-50 border border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                            <tr>
                              <th className="px-4 py-3">Refacción</th>
                              <th className="px-4 py-3">Estado</th>
                              <th className="px-4 py-3">Stock</th>
                              <th className="px-4 py-3">Tickets relacionados</th>
                              <th className="px-4 py-3">Acciones (DEMO)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 border border-slate-200">
                            {inventory.map(it => {
                              const key = normalizePart(it.name);
                              const linked = partToTickets[key] || [];
                              return (
                                <InventoryRow
                                  key={it.id}
                                  item={it}
                                  linkedTickets={linked}
                                  onAdjust={d => adjustInventory(it.id, d)}
                                  onReceiveToReorder={() => receiveToReorder(it.id)}
                                  onQuickConsume={() => consumeOne(it.id)}
                                />
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 text-[11px] text-slate-400">
                        *DEMO: ajustes y OC son locales para mostrar el concepto. Implementación real define aprobación, proveedor, costos y responsable.
                      </div>
                    </SectionCard>
                  </div>

                  {/* Lista de tickets con refacción (apoyo a buy) */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-slate-400" />
                        <h3 className="font-bold text-slate-800">Tickets con refacción</h3>
                      </div>
                      <div className="text-[11px] text-slate-400">Derivado de tickets marcados como “Espera refacción”.</div>
                    </div>

                    <div className="p-6">
                      {partsNeeded.length === 0 ? (
                        <p className="text-slate-500 text-center py-4">No hay refacciones pendientes.</p>
                      ) : (
                        <ul className="space-y-3">
                          {partsNeeded.map(t => {
                            const partKey = normalizePart(t.partName || '');
                            const inv = inventoryIndex[partKey];
                            const b = inv ? stockBadge(inv.onHand, inv.min) : null;

                            return (
                              <li
                                key={t.id}
                                className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border p-4 rounded-xl bg-slate-50 border-slate-200"
                              >
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-medium text-slate-900">{t.partName || 'Refacción pendiente (DEMO)'}</div>
                                    {b ? (
                                      <Pill className={b.cls}>{b.label}</Pill>
                                    ) : (
                                      <Pill className="bg-amber-50 text-amber-800 border-amber-200">NO EN CATÁLOGO</Pill>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    Ticket {t.id} (Hab {t.roomNumber})
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setSelectedTicket(t)}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                                  >
                                    Ver ticket
                                  </button>
                                  <button
                                    onClick={() => {
                                      const el = document.getElementById('inventory-panel');
                                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      fireToast('Inventario: revisa stock y genera OC (DEMO)');
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                                  >
                                    Ver inventario
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'VENDOR' && (
                <div id="vendor-panel" className="p-6">
                  {vendorNeeded.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">No hay servicios externos pendientes.</p>
                  ) : (
                    <ul className="space-y-3">
                      {vendorNeeded.map(t => (
                        <li key={t.id} className="flex justify-between items-center border p-3 rounded-lg bg-slate-50 border-slate-200">
                          <div>
                            <div className="font-medium text-slate-900">{t.vendorType || 'Proveedor pendiente (DEMO)'}</div>
                            <div className="text-xs text-slate-500">
                              {t.description} (Hab {t.roomNumber})
                            </div>
                          </div>
                          <span className="text-xs bg-white border border-slate-300 px-3 py-1 rounded shadow-sm">Orden (DEMO)</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-6">Incidencias por Activo (Frecuencia)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Bar dataKey="value" fill="#64748b" radius={[0, 4, 4, 0]} barSize={20}>
                    {assetData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index < 2 ? '#e11d48' : '#64748b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-slate-400" />
              <h3 className="font-bold text-slate-800">Carga Estimada (Turno)</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Mañana</span>
                <span className="font-bold text-slate-900">
                  {morningLoad} <span className="text-xs font-normal text-slate-400">técnicos</span>
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Tarde</span>
                <span className="font-bold text-slate-900">
                  {eveningLoad} <span className="text-xs font-normal text-slate-400">técnicos</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Noche</span>
                <span className="font-bold text-slate-900">
                  1 <span className="text-xs font-normal text-slate-400">guardia</span>
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 leading-tight">
                *Estimación DEMO basada en volumen de tickets “accionables” (reportado/en proceso/resuelto).
              </p>
            </div>
          </div>

          {/* Mini resumen inventario (para Marc) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold text-slate-800">Inventario (snapshot)</h3>
              </div>
              <button
                onClick={() => {
                  setTab('BUY');
                  setTimeout(
                    () => document.getElementById('inventory-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                    80
                  );
                }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
              >
                Ver <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Sin stock</div>
                <div className="text-2xl font-black text-slate-900">{inventoryKPIs.outOfStock.length}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Bajo</div>
                <div className="text-2xl font-black text-slate-900">{inventoryKPIs.low.length}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">OC (DEMO)</div>
                <div className="text-2xl font-black text-slate-900">{purchaseOrders.length}</div>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-slate-400">*Visible para Marc: evidencia “qué comprar” y el porqué.</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-800">Habitaciones Críticas</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {tickets
                .filter(t => t.status !== TicketStatus.VERIFIED && isCriticalTicket(t))
                .slice(0, 6)
                .map(t => (
                  <button
                    key={t.id}
                    className="w-full text-left px-6 py-3 flex justify-between items-center hover:bg-slate-50"
                    onClick={() => setSelectedTicket(t)}
                  >
                    <span className="font-medium text-slate-900 text-sm">Hab {t.roomNumber}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(t.status)}`}>{t.status}</span>
                  </button>
                ))}
              {tickets.filter(t => t.status !== TicketStatus.VERIFIED && isCriticalTicket(t)).length === 0 && (
                <div className="px-6 py-4 text-sm text-slate-500 text-center">Todo en orden</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Room modal */}
      <RoomTicketsModal
        room={selectedRoom}
        tickets={tickets}
        onClose={() => setSelectedRoom(null)}
        onOpenTicket={t => {
          setSelectedTicket(t);
          setSelectedRoom(null);
        }}
        roomHot={selectedRoom ? isRoomHotspot(selectedRoom) : false}
        roomRecurrent={selectedRoom ? !!roomRecurrent[selectedRoom] : false}
        recurrentKeyCount={recurrentKeyCount}
      />

      {/* Ticket modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        isRecurrent={selectedTicket ? isTicketRecurrent(selectedTicket) : false}
        isHotspotRoom={selectedTicket ? isRoomHotspot(selectedTicket.roomNumber) : false}
      />

      {/* PO modal */}
      <PurchaseOrderModal open={poModalOpen} onClose={() => setPoModalOpen(false)} po={activePO} />

      {/* Tour overlay */}
      <TourOverlay
        active={tourActive}
        stepIndex={tourStep}
        steps={steps}
        highlight={highlight}
        onNext={nextTour}
        onPrev={prevTour}
        onExit={exitTour}
      />
    </div>
  );
};
