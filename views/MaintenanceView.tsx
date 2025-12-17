import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Role, Ticket, TicketStatus, Urgency } from '../types';
import { Button } from '../components/Button';
import { getStatusColor, getUrgencyColor } from '../utils';
import {
  Check,
  PenTool,
  Box,
  UserPlus,
  AlertOctagon,
  ClipboardList,
  Package,
  Search,
  X,
  ArrowDownCircle,
  AlertTriangle
} from 'lucide-react';

// ============================
// INVENTARIO (DEMO) — LOCAL ONLY
// ============================

type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  location: string;
  unit: string;
  stock: number;
  minStock: number;
  supplier?: string;
  cost?: number;
  updatedAt?: string; // ISO
};

const INVENTORY_KEY = 'metodiko_demo_inventory';

const DEFAULT_INVENTORY: InventoryItem[] = [
  {
    id: 'P-1001',
    sku: 'ELEC-OUT-001',
    name: 'Outlet Universal Premium Blanco',
    location: 'Bodega A · Estante 2',
    unit: 'pza',
    stock: 2,
    minStock: 4,
    supplier: 'Proveedor Eléctrico',
    cost: 145,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'P-1002',
    sku: 'PLOM-EMP-012',
    name: 'Empaque Grifo Lavabo 1/2"',
    location: 'Caja Plomería · A-03',
    unit: 'pza',
    stock: 12,
    minStock: 10,
    supplier: 'Ferretería',
    cost: 15,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'P-1003',
    sku: 'HVAC-CAP-035',
    name: 'Capacitor Aire Acondicionado 35uF',
    location: 'Bodega A · Estante 1',
    unit: 'pza',
    stock: 1,
    minStock: 3,
    supplier: 'Proveedor HVAC',
    cost: 320,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'P-1004',
    sku: 'HVAC-REM-UNI',
    name: 'Control Remoto MiniSplit (Universal)',
    location: 'Recepción · Caja repuestos',
    unit: 'pza',
    stock: 3,
    minStock: 2,
    supplier: 'Proveedor HVAC',
    cost: 220,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'P-1005',
    sku: 'ELEC-BAT-AA4',
    name: 'Baterías AA (4 pack)',
    location: 'Bodega B · Consumibles',
    unit: 'pack',
    stock: 6,
    minStock: 4,
    supplier: 'Proveedor General',
    cost: 48,
    updatedAt: new Date().toISOString()
  }
];

const loadInventory = (): InventoryItem[] => {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    if (!raw) return DEFAULT_INVENTORY;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_INVENTORY;
    // normalización ligera
    return parsed.map((x: any) => ({
      id: String(x.id || ''),
      sku: String(x.sku || ''),
      name: String(x.name || ''),
      location: String(x.location || ''),
      unit: String(x.unit || 'pza'),
      stock: Number.isFinite(Number(x.stock)) ? Number(x.stock) : 0,
      minStock: Number.isFinite(Number(x.minStock)) ? Number(x.minStock) : 0,
      supplier: x.supplier ? String(x.supplier) : undefined,
      cost: Number.isFinite(Number(x.cost)) ? Number(x.cost) : undefined,
      updatedAt: x.updatedAt ? String(x.updatedAt) : undefined
    })) as InventoryItem[];
  } catch {
    return DEFAULT_INVENTORY;
  }
};

const isLow = (i: InventoryItem) => i.stock <= i.minStock;

const consumeFromInventory = (items: InventoryItem[], itemId: string, qty: number): InventoryItem[] => {
  const q = Math.max(1, Math.floor(qty || 1));
  return items.map(i => {
    if (i.id !== itemId) return i;
    const next = Math.max(0, i.stock - q);
    return { ...i, stock: next, updatedAt: new Date().toISOString() };
  });
};

const STATUS_STEPS: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_PART,
  TicketStatus.VENDOR,
  TicketStatus.RESOLVED,
  TicketStatus.VERIFIED
];

const statusLabelShort = (s: TicketStatus) => {
  switch (s) {
    case TicketStatus.OPEN:
      return 'Reportado';
    case TicketStatus.IN_PROGRESS:
      return 'En proceso';
    case TicketStatus.WAITING_PART:
      return 'Refacción';
    case TicketStatus.VENDOR:
      return 'Proveedor';
    case TicketStatus.RESOLVED:
      return 'Resuelto';
    case TicketStatus.VERIFIED:
      return 'Verificado';
    default:
      return s;
  }
};

const TicketCard: React.FC<{ ticket: Ticket; onEdit: (t: Ticket) => void }> = ({ ticket, onEdit }) => {
  return (
    <div
      className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden"
      onClick={() => onEdit(ticket)}
    >
      {ticket.isOccupied && (
        <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] px-2 py-0.5 rounded-bl-lg font-bold">
          OCUPADA
        </div>
      )}

      <div className="flex justify-between items-start mb-2 mt-1">
        <div>
          <span className="text-xs font-mono text-slate-400 block mb-1">{ticket.id}</span>
          <h4 className="font-bold text-lg text-slate-900 flex items-center gap-2">
            Hab {ticket.roomNumber}
            <span className="text-sm font-normal text-slate-500">· {ticket.asset}</span>
          </h4>
        </div>
        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(ticket.status)}`}>
          {ticket.status}
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-3 truncate">{ticket.description}</p>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs">
          <span className={`${getUrgencyColor(ticket.urgency)}`}>{ticket.urgency}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">{new Date(ticket.createdAt).toLocaleDateString()}</span>
        </div>
        {ticket.assignedTo ? (
          <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            {ticket.assignedTo}
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">Sin asignar</span>
        )}
      </div>
    </div>
  );
};

const StatusTimeline: React.FC<{ status: TicketStatus }> = ({ status }) => {
  const idx = STATUS_STEPS.indexOf(status);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <div className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
        <ClipboardList className="w-4 h-4" /> Flujo (DEMO)
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_STEPS.map((s, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <div
              key={s}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                current
                  ? 'bg-slate-900 text-white border-slate-900'
                  : done
                    ? 'bg-white text-slate-700 border-slate-300'
                    : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              {statusLabelShort(s)}
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-slate-400">*Trazabilidad visible en Audit Log (quién hizo qué y cuándo).</div>
    </div>
  );
};

const InventoryDrawer: React.FC<{
  open: boolean;
  title?: string;
  role: Role;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  onClose: () => void;
  onPick?: (item: InventoryItem) => void; // si se usa como selector de refacción
}> = ({ open, title = 'Inventario de Refacciones (DEMO)', role, inventory, setInventory, onClose, onPick }) => {
  const [q, setQ] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setOnlyLow(false);
  }, [open]);

  const canConsume = role === Role.MAINTENANCE || role === Role.MANAGEMENT;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return inventory
      .filter(i => {
        if (onlyLow && !isLow(i)) return false;
        if (!term) return true;
        return (
          i.name.toLowerCase().includes(term) ||
          i.sku.toLowerCase().includes(term) ||
          i.location.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        // low stock arriba
        const al = isLow(a) ? 1 : 0;
        const bl = isLow(b) ? 1 : 0;
        if (al !== bl) return bl - al;
        return a.name.localeCompare(b.name);
      });
  }, [inventory, q, onlyLow]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full sm:w-[760px] bg-white shadow-2xl border-l border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200 flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">MÓDULO INVENTARIO</div>
            <div className="text-lg font-bold text-slate-900">{title}</div>
            <div className="text-xs text-slate-500 mt-1">
              Visible para Mantenimiento (con permisos) y para Gerencia.
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por SKU, artículo o ubicación…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-slate-500"
              />
            </div>

            <button
              onClick={() => setOnlyLow(v => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold ${
                onlyLow ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-4 h-4" /> Bajo stock
            </button>
          </div>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="text-sm text-slate-500">Sin resultados.</div>}

          <div className="space-y-3">
            {filtered.map(item => {
              const low = isLow(item);
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 ${low ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-slate-900 truncate">{item.name}</div>
                        {low && (
                          <span className="text-[10px] font-bold uppercase bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-full">
                            Bajo stock
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        <span className="font-mono text-slate-600">{item.sku}</span>
                        <span className="text-slate-300"> • </span>
                        {item.location}
                        <span className="text-slate-300"> • </span>
                        Unidad: <span className="font-semibold">{item.unit}</span>
                      </div>
                      {item.supplier && (
                        <div className="text-[11px] text-slate-500 mt-1">
                          Proveedor: <span className="font-semibold">{item.supplier}</span>
                          {Number.isFinite(item.cost) && (
                            <>
                              <span className="text-slate-300"> • </span>
                              Costo: <span className="font-semibold">${item.cost}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-500">Stock</div>
                      <div className={`text-2xl font-bold ${low ? 'text-amber-900' : 'text-slate-900'}`}>{item.stock}</div>
                      <div className="text-[11px] text-slate-500">Mín: {item.minStock}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 justify-end">
                    {onPick && (
                      <button
                        onClick={() => onPick(item)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                        title="Seleccionar esta refacción para el ticket"
                      >
                        <ArrowDownCircle className="w-4 h-4" /> Seleccionar
                      </button>
                    )}

                    {canConsume && (
                      <button
                        onClick={() => {
                          setInventory(prev => consumeFromInventory(prev, item.id, 1));
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                        title="Consumir 1 unidad del inventario"
                      >
                        <Package className="w-4 h-4" /> Consumir 1
                      </button>
                    )}
                  </div>

                  <div className="mt-3 text-[10px] text-slate-400">
                    {item.updatedAt ? `Actualizado: ${new Date(item.updatedAt).toLocaleString()}` : 'Actualización: —'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 text-[11px] text-slate-400">
          *DEMO: inventario local (LocalStorage). En producción se conectaría a un sistema real y control de permisos.
        </div>
      </div>
    </div>
  );
};

const TicketEditModal: React.FC<{
  ticket: Ticket | null;
  onClose: () => void;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  openInventoryPicker: (onPick: (item: InventoryItem) => void) => void;
  roleForPerms: Role;
}> = ({ ticket, onClose, inventory, setInventory, openInventoryPicker, roleForPerms }) => {
  const { updateTicket, role } = useApp();
  const [note, setNote] = useState('');
  const [partName, setPartName] = useState(ticket?.partName || '');
  const [vendorType, setVendorType] = useState(ticket?.vendorType || '');
  const [pendingAction, setPendingAction] = useState<null | 'PART' | 'VENDOR'>(null);

  const [checkClean, setCheckClean] = useState(false);
  const [checkWorking, setCheckWorking] = useState(false);

  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [consumeQty, setConsumeQty] = useState(1);
  const [inlineMsg, setInlineMsg] = useState('');

  useEffect(() => {
    if (!ticket) return;
    setPartName(ticket.partName || '');
    setVendorType(ticket.vendorType || '');
    setPendingAction(null);
    setSelectedPartId(null);
    setConsumeQty(1);
    setInlineMsg('');
    setCheckClean(false);
    setCheckWorking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id]);

  if (!ticket) return null;

  const canConsume = roleForPerms === Role.MAINTENANCE || roleForPerms === Role.MANAGEMENT;

  const selectedPart = selectedPartId ? inventory.find(i => i.id === selectedPartId) : null;

  const flash = (msg: string) => {
    setInlineMsg(msg);
    window.clearTimeout((flash as any)._t);
    (flash as any)._t = window.setTimeout(() => setInlineMsg(''), 2200);
  };

  const handleAssign = () => {
    updateTicket(ticket.id, { assignedTo: 'Técnico Demo' }, 'Asignado a Técnico Demo');
  };

  const setStatus = (newStatus: TicketStatus, extra?: Partial<Ticket>, action?: string) => {
    const updates: Partial<Ticket> = { status: newStatus, ...(extra || {}) };

    let actionDescription = action || `Estado cambiado a ${newStatus}`;

    if (newStatus === TicketStatus.RESOLVED) {
      actionDescription = 'Marcado como Resuelto — Pendiente de verificación';
    }

    if (newStatus === TicketStatus.VERIFIED) {
      updates.verifiedBy = role;
      updates.closedAt = new Date().toISOString();
      actionDescription = `Verificado y Cerrado por ${role}`;
    }

    updateTicket(ticket.id, updates, actionDescription);
    onClose();
  };

  const handleAddNote = () => {
    if (!note.trim()) return;
    const n = note.trim();
    updateTicket(ticket.id, { notes: [...ticket.notes, n] }, `Nota agregada: ${n.slice(0, 28)}${n.length > 28 ? '…' : ''}`);
    setNote('');
  };

  const confirmPart = () => {
    const name = (partName || '').trim() || (selectedPart?.name ?? 'Refacción (DEMO)');
    setStatus(TicketStatus.WAITING_PART, { needsPart: true, partName: name }, `Marcado espera refacción: ${name}`);
  };

  const confirmVendor = () => {
    const v = (vendorType || '').trim() || 'Proveedor (DEMO)';
    setStatus(TicketStatus.VENDOR, { needsVendor: true, vendorType: v }, `Marcado para proveedor: ${v}`);
  };

  const pickPartFromInventory = () => {
    openInventoryPicker((item) => {
      setPendingAction('PART');
      setSelectedPartId(item.id);
      setPartName(item.name);
      flash(`Seleccionado: ${item.name}`);
    });
  };

  const consumeSelected = () => {
    if (!canConsume) return;
    if (!selectedPart) {
      flash('Selecciona una refacción del inventario.');
      return;
    }
    const q = Math.max(1, Math.floor(Number(consumeQty || 1)));
    if (selectedPart.stock < q) {
      flash(`Stock insuficiente (disponible: ${selectedPart.stock}).`);
      return;
    }

    setInventory(prev => consumeFromInventory(prev, selectedPart.id, q));

    const noteLine = `Consumido de inventario: ${selectedPart.name} (${selectedPart.sku}) x${q}`;
    updateTicket(ticket.id, { notes: [...ticket.notes, noteLine] }, noteLine);
    flash('Consumo registrado en inventario y en notas.');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-6 border-b border-slate-200 flex justify-between items-start">
          <div>
            <span className="text-xs font-mono text-slate-400">{ticket.id}</span>
            <h2 className="text-2xl font-bold text-slate-900">Habitación {ticket.roomNumber}</h2>
            <div className="text-sm text-slate-500 mt-1">
              {ticket.asset} — {ticket.issueType} · <span className="font-semibold">{ticket.createdBy}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {inlineMsg && (
            <div className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-3 rounded-lg text-sm">
              {inlineMsg}
            </div>
          )}

          <StatusTimeline status={ticket.status} />

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pb-6 border-b border-slate-100">
            {!ticket.assignedTo && ticket.status !== TicketStatus.VERIFIED && (
              <Button onClick={handleAssign} size="sm" variant="secondary">
                <UserPlus className="w-4 h-4 mr-2" /> Tomar Ticket
              </Button>
            )}

            {ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.VERIFIED && (
              <>
                <Button onClick={() => setStatus(TicketStatus.IN_PROGRESS)} size="sm" variant={ticket.status === TicketStatus.IN_PROGRESS ? 'primary' : 'ghost'}>
                  En Proceso
                </Button>

                <Button
                  onClick={() => setPendingAction('PART')}
                  size="sm"
                  variant={ticket.status === TicketStatus.WAITING_PART ? 'primary' : 'ghost'}
                >
                  <Box className="w-4 h-4 mr-1" /> Falta Pieza
                </Button>

                <Button
                  onClick={() => setPendingAction('VENDOR')}
                  size="sm"
                  variant={ticket.status === TicketStatus.VENDOR ? 'primary' : 'ghost'}
                >
                  <AlertOctagon className="w-4 h-4 mr-1" /> Proveedor
                </Button>

                <Button onClick={() => setStatus(TicketStatus.RESOLVED)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Check className="w-4 h-4 mr-1" /> Resolver
                </Button>
              </>
            )}
          </div>

          {/* Inline action panels (sin prompt) */}
          {pendingAction === 'PART' && ticket.status !== TicketStatus.VERIFIED && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-amber-800 mb-1">Espera refacción (DEMO)</div>
                  <div className="text-xs text-amber-700">
                    Registrar refacción alimenta el panel de Gerencia “¿Qué comprar?” y habilita el control de inventario.
                  </div>
                </div>
                <button
                  onClick={pickPartFromInventory}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  <Package className="w-4 h-4" /> Buscar en inventario
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="md:col-span-2">
                  <input
                    value={partName}
                    onChange={(e) => setPartName(e.target.value)}
                    className="w-full border border-amber-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                    placeholder="Nombre de refacción…"
                  />
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={confirmPart} className="flex-1">Confirmar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPendingAction(null)} className="flex-1">Cancelar</Button>
                </div>
              </div>

              {selectedPart && (
                <div className="mt-3 bg-white/70 border border-amber-200 rounded-lg p-3">
                  <div className="text-xs font-bold text-slate-700">Inventario seleccionado</div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">{selectedPart.name}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    <span className="font-mono">{selectedPart.sku}</span>
                    <span className="text-slate-300"> • </span>
                    {selectedPart.location}
                    <span className="text-slate-300"> • </span>
                    Stock: <span className={`font-bold ${isLow(selectedPart) ? 'text-amber-800' : 'text-slate-900'}`}>{selectedPart.stock}</span>
                    <span className="text-slate-300"> / </span>
                    Mín: <span className="font-semibold">{selectedPart.minStock}</span>
                  </div>

                  {canConsume && (
                    <div className="mt-3 flex flex-wrap gap-2 items-center justify-end">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Consumir</span>
                        <input
                          type="number"
                          min={1}
                          value={consumeQty}
                          onChange={(e) => setConsumeQty(Number(e.target.value))}
                          className="w-20 border border-slate-300 rounded px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-slate-400">{selectedPart.unit}</span>
                      </div>
                      <button
                        onClick={consumeSelected}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                      >
                        <Package className="w-4 h-4" /> Consumir y registrar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {pendingAction === 'VENDOR' && ticket.status !== TicketStatus.VERIFIED && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
              <div className="text-sm font-bold text-purple-800 mb-2">Requiere proveedor (DEMO)</div>
              <div className="text-xs text-purple-700 mb-3">Registrar tipo de proveedor alimenta “¿Qué tercerizar?” para Gerencia.</div>
              <div className="flex gap-2">
                <input
                  value={vendorType}
                  onChange={(e) => setVendorType(e.target.value)}
                  className="flex-1 border border-purple-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                  placeholder="Tipo de proveedor…"
                />
                <Button size="sm" onClick={confirmVendor}>Confirmar</Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingAction(null)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Resolved -> Verification */}
          {ticket.status === TicketStatus.RESOLVED && (
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg">
              <h4 className="text-emerald-800 font-bold text-sm mb-2">Checklist de Verificación</h4>
              <div className="space-y-2 mb-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded text-emerald-600"
                    checked={checkClean}
                    onChange={(e) => setCheckClean(e.target.checked)}
                  />
                  El área quedó limpia
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded text-emerald-600"
                    checked={checkWorking}
                    onChange={(e) => setCheckWorking(e.target.checked)}
                  />
                  El activo funciona correctamente
                </label>
              </div>
              <Button onClick={() => setStatus(TicketStatus.VERIFIED)} disabled={!(checkClean && checkWorking)} size="sm" className="w-full">
                Confirmar y Cerrar
              </Button>
            </div>
          )}

          {/* Details + Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Detalles</h4>
              <div className="bg-slate-50 p-4 rounded-lg space-y-3 text-sm">
                <p>
                  <span className="font-semibold">Descripción:</span> {ticket.description}
                </p>
                <p>
                  <span className="font-semibold">Urgencia:</span> {ticket.urgency}
                </p>
                <p>
                  <span className="font-semibold">Impacto:</span> {ticket.impact}
                </p>
                {ticket.needsPart && <p className="text-amber-700 font-semibold">Refacción: {ticket.partName}</p>}
                {ticket.needsVendor && <p className="text-purple-700 font-semibold">Proveedor: {ticket.vendorType}</p>}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Notas Técnicas</h4>
              <div className="space-y-2 mb-2 max-h-40 overflow-y-auto">
                {ticket.notes.length === 0 && <p className="text-xs text-slate-400 italic">Sin notas.</p>}
                {ticket.notes.map((n, i) => (
                  <div key={i} className="bg-yellow-50 p-2 rounded border border-yellow-100 text-xs text-slate-700">
                    {n}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-slate-500"
                  placeholder="Agregar nota..."
                />
                <Button onClick={handleAddNote} size="sm" variant="secondary">
                  <PenTool className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Audit Log */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Audit Log</h4>
            <div className="border-l-2 border-slate-200 pl-4 space-y-4 max-h-48 overflow-y-auto">
              {ticket.history.map((h, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white"></div>
                  <p className="text-xs text-slate-500 mb-0.5">
                    {new Date(h.date).toLocaleString()} <span className="text-slate-300">•</span> {h.user}
                  </p>
                  <p className="text-sm font-medium text-slate-800">{h.action}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-400">*DEMO: datos simulados, sin integraciones externas.</div>
        </div>
      </div>
    </div>
  );
};

export const MaintenanceView: React.FC = () => {
  const { tickets, role } = useApp();
  const [filter, setFilter] = useState<'ALL' | 'URGENT' | 'CLOSED'>('ALL');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // INVENTORY STATE (shared via LocalStorage)
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invOpen, setInvOpen] = useState(false);
  const [invPick, setInvPick] = useState<null | ((item: InventoryItem) => void)>(null);

  useEffect(() => {
    setInventory(loadInventory());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
    } catch {
      // ignore
    }
  }, [inventory]);

  const lowCount = useMemo(() => inventory.filter(isLow).length, [inventory]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (filter === 'ALL') return t.status !== TicketStatus.VERIFIED;
      if (filter === 'URGENT') return t.urgency === Urgency.HIGH && t.status !== TicketStatus.VERIFIED;
      if (filter === 'CLOSED') return t.status === TicketStatus.VERIFIED;
      return true;
    });
  }, [tickets, filter]);

  const openInventoryBrowse = () => {
    setInvPick(null);
    setInvOpen(true);
  };

  const openInventoryPicker = (onPick: (item: InventoryItem) => void) => {
    setInvPick(() => onPick);
    setInvOpen(true);
  };

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cola de Trabajo</h2>
          <p className="text-slate-500">Gestión de tickets + inventario de refacciones (DEMO).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openInventoryBrowse}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
            title="Ver inventario de refacciones"
          >
            <Package className="w-4 h-4" /> Inventario
            {lowCount > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                {lowCount} bajo
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'ALL' ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-500'
              }`}
            >
              Activos
            </button>
            <button
              onClick={() => setFilter('URGENT')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'URGENT' ? 'bg-rose-50 font-medium text-rose-700' : 'text-slate-500'
              }`}
            >
              Urgentes
            </button>
            <button
              onClick={() => setFilter('CLOSED')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'CLOSED' ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-500'
              }`}
            >
              Cerrados
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTickets.map(ticket => (
          <TicketCard key={ticket.id} ticket={ticket} onEdit={setSelectedTicket} />
        ))}
      </div>

      {selectedTicket && (
        <TicketEditModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          inventory={inventory}
          setInventory={setInventory}
          openInventoryPicker={openInventoryPicker}
          roleForPerms={role}
        />
      )}

      <InventoryDrawer
        open={invOpen}
        role={role}
        inventory={inventory}
        setInventory={setInventory}
        onClose={() => {
          setInvOpen(false);
          setInvPick(null);
        }}
        onPick={invPick ? (item) => {
          // pick mode: seleccionar para ticket
          invPick(item);
          setInvOpen(false);
          setInvPick(null);
        } : undefined}
        title={invPick ? 'Seleccionar refacción para ticket (DEMO)' : 'Inventario de Refacciones (DEMO)'}
      />
    </div>
  );
};
