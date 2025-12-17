// src/AppContext.tsx

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AuditEvent,
  InventoryPart,
  PartMovement,
  POStatus,
  PurchaseOrder,
  Role,
  Ticket,
  TicketStatus,
  Urgency,
  Impact,
} from './types';
import { INITIAL_PARTS, INITIAL_POS, INITIAL_TICKETS } from './constants';
import { calculatePriority } from './utils';

type DemoScenario = 'GUEST_COMPLAINT' | 'CLEANING_REPORT' | 'BLOCK_PART' | 'BLOCK_VENDOR';

interface AppContextType {
  role: Role;
  setRole: (role: Role) => void;

  // Tickets
  tickets: Ticket[];
  addTicket: (ticket: Omit<Ticket, 'id' | 'createdAt' | 'history' | 'priorityScore' | 'status'>) => void;
  updateTicket: (id: string, updates: Partial<Ticket>, actionDescription: string) => void;

  // Inventario
  parts: InventoryPart[];
  pos: PurchaseOrder[];
  movements: PartMovement[];

  // Acciones inventario (con permisos)
  reservePartForTicket: (ticketId: string, partId: string, qty: number) => { ok: boolean; message: string };
  releaseReservationForTicket: (ticketId: string, note?: string) => { ok: boolean; message: string };
  issueReservedPartForTicket: (ticketId: string, note?: string) => { ok: boolean; message: string };

  createPOForPart: (params: {
    partId: string;
    qty: number;
    vendor?: string;
    etaDays?: number;
    ticketId?: string;
  }) => { ok: boolean; message: string; poId?: string };
  receivePO: (poId: string) => { ok: boolean; message: string };
  adjustStock: (params: { partId: string; delta: number; note?: string }) => { ok: boolean; message: string };

  // Utilidades
  resetDemoData: () => void;
  exportCSV: () => void;

  // Escenarios demo
  runScenario: (scenario: DemoScenario) => string | null;

  // Permisos para UI
  permissions: {
    canViewInventory: boolean; // Marc + Mantenimiento
    canReserve: boolean; // Marc + Mantenimiento
    canCreatePO: boolean; // solo Marc
    canAdjustStock: boolean; // solo Marc
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// =========================
// Helpers
// =========================

const nextId = (prefix: string, existingIds: string[], start: number) => {
  const max = existingIds.reduce((m, id) => {
    const n = parseInt(String(id).replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, start);
  return `${prefix}${max + 1}`;
};

const nextTicketId = (tickets: Ticket[]) => nextId('T-', tickets.map(t => t.id), 1000);
const nextMovementId = (movs: PartMovement[]) => nextId('M-', movs.map(m => m.id), 0);
const nextPOId = (pos: PurchaseOrder[]) => nextId('OC-', pos.map(p => p.id), 0);

const createAudit = (user: Role, action: string): AuditEvent => ({
  date: new Date().toISOString(),
  action,
  user,
});

const clampNonNeg = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

// Helper to resolve part by name (para migración DEMO)
const findPartIdByName = (parts: InventoryPart[], name?: string) => {
  if (!name) return undefined;
  const match = parts.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
  return match?.id;
};

const buildTicket = (
  tickets: Ticket[],
  data: Omit<Ticket, 'id' | 'createdAt' | 'history' | 'priorityScore'>,
  auditUser: Role,
  auditAction: string
): Ticket => {
  const t: Ticket = {
    ...data,
    id: nextTicketId(tickets),
    createdAt: new Date().toISOString(),
    history: [createAudit(auditUser, auditAction)],
    priorityScore: 0,
  };
  t.priorityScore = calculatePriority(t);
  return t;
};

// =========================
// Provider
// =========================

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<Role>(Role.MANAGEMENT);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [movements, setMovements] = useState<PartMovement[]>([]);

  const [hydrated, setHydrated] = useState(false);
  const didHydrate = useRef(false);

  const permissions = useMemo(() => {
    const canViewInventory = role === Role.MANAGEMENT || role === Role.MAINTENANCE;
    const canReserve = role === Role.MANAGEMENT || role === Role.MAINTENANCE;
    const canCreatePO = role === Role.MANAGEMENT;
    const canAdjustStock = role === Role.MANAGEMENT;
    return { canViewInventory, canReserve, canCreatePO, canAdjustStock };
  }, [role]);

  // Load from local storage or init
  useEffect(() => {
    const storedTickets = localStorage.getItem('metodiko_demo_tickets');
    const storedParts = localStorage.getItem('metodiko_demo_parts');
    const storedPOs = localStorage.getItem('metodiko_demo_pos');
    const storedMovs = localStorage.getItem('metodiko_demo_movements');

    // Parts
    let loadedParts: InventoryPart[] = INITIAL_PARTS;
    if (storedParts) {
      try {
        loadedParts = JSON.parse(storedParts);
      } catch {
        loadedParts = INITIAL_PARTS;
      }
    }

    // Tickets
    let loadedTickets: Ticket[] = INITIAL_TICKETS;
    if (storedTickets) {
      try {
        loadedTickets = JSON.parse(storedTickets);
      } catch {
        loadedTickets = INITIAL_TICKETS;
      }
    }

    // Migración suave (DEMO): mapear partName -> partId si falta
    loadedTickets = loadedTickets.map(t => {
      const patched: Ticket = { ...t };
      if (patched.needsPart && !patched.partId && patched.partName) {
        const pid = findPartIdByName(loadedParts, patched.partName);
        if (pid) patched.partId = pid;
      }
      return { ...patched, priorityScore: calculatePriority(patched) };
    });

    // POs
    let loadedPOs: PurchaseOrder[] = INITIAL_POS;
    if (storedPOs) {
      try {
        loadedPOs = JSON.parse(storedPOs);
      } catch {
        loadedPOs = INITIAL_POS;
      }
    }

    // Movements
    let loadedMovs: PartMovement[] = [];
    if (storedMovs) {
      try {
        loadedMovs = JSON.parse(storedMovs);
      } catch {
        loadedMovs = [];
      }
    }

    setParts(loadedParts);
    setTickets(loadedTickets);
    setPos(loadedPOs);
    setMovements(loadedMovs);

    didHydrate.current = true;
    setHydrated(true);
  }, []);

  // Save to local storage on change (solo después de hidratar)
  useEffect(() => {
    if (!hydrated || !didHydrate.current) return;
    localStorage.setItem('metodiko_demo_tickets', JSON.stringify(tickets));
  }, [tickets, hydrated]);

  useEffect(() => {
    if (!hydrated || !didHydrate.current) return;
    localStorage.setItem('metodiko_demo_parts', JSON.stringify(parts));
  }, [parts, hydrated]);

  useEffect(() => {
    if (!hydrated || !didHydrate.current) return;
    localStorage.setItem('metodiko_demo_pos', JSON.stringify(pos));
  }, [pos, hydrated]);

  useEffect(() => {
    if (!hydrated || !didHydrate.current) return;
    localStorage.setItem('metodiko_demo_movements', JSON.stringify(movements));
  }, [movements, hydrated]);

  // =========================
  // Tickets
  // =========================

  const addTicket = (data: Omit<Ticket, 'id' | 'createdAt' | 'history' | 'priorityScore' | 'status'>) => {
    const newTicket: Ticket = {
      ...data,
      id: nextTicketId(tickets),
      createdAt: new Date().toISOString(),
      status: TicketStatus.OPEN,
      priorityScore: 0,
      history: [createAudit(role, 'Ticket Creado')],
    };
    newTicket.priorityScore = calculatePriority(newTicket);
    setTickets(prev => [newTicket, ...prev]);
  };

  const updateTicket = (id: string, updates: Partial<Ticket>, actionDescription: string) => {
    setTickets(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };
        updated.history = [...updated.history, createAudit(role, actionDescription)];
        updated.priorityScore = calculatePriority(updated);
        return updated;
      })
    );
  };

  const updateTicketAs = (user: Role, id: string, updates: Partial<Ticket>, action: string) => {
    setTickets(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };
        updated.history = [...updated.history, createAudit(user, action)];
        updated.priorityScore = calculatePriority(updated);
        return updated;
      })
    );
  };

  // =========================
  // Inventario
  // =========================

  const addMovement = (m: Omit<PartMovement, 'id' | 'date' | 'user'>) => {
    setMovements(prev => [
      {
        ...m,
        id: nextMovementId(prev),
        date: new Date().toISOString(),
        user: role,
      },
      ...prev,
    ]);
  };

  const reservePartForTicket = (ticketId: string, partId: string, qty: number) => {
    if (!permissions.canReserve) return { ok: false, message: 'Permiso insuficiente para reservar refacciones.' };
    const q = Math.max(1, Math.floor(qty || 1));

    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return { ok: false, message: 'Ticket no encontrado.' };

    const part = parts.find(p => p.id === partId);
    if (!part) return { ok: false, message: 'Refacción no encontrada.' };

    const available = clampNonNeg(part.stockOnHand - part.stockReserved);
    if (available < q) {
      return {
        ok: false,
        message: `Stock insuficiente. Disponible: ${available}. Requerido: ${q}.`,
      };
    }

    // Si ya tenía una refacción reservada, liberarla primero (para evitar dobles reservas)
    if (ticket.partId && ticket.partQty && ticket.partQty > 0) {
      // Liberar reserva anterior (si existe)
      setParts(prev =>
        prev.map(p => {
          if (p.id !== ticket.partId) return p;
          return { ...p, stockReserved: clampNonNeg(p.stockReserved - ticket.partQty!) };
        })
      );
      addMovement({
        partId: ticket.partId,
        type: 'RELEASE',
        qty: ticket.partQty,
        note: 'Cambio de refacción / ajuste de reserva (DEMO)',
        ticketId,
      });
    }

    // Reservar
    setParts(prev =>
      prev.map(p => (p.id === partId ? { ...p, stockReserved: p.stockReserved + q } : p))
    );

    updateTicket(
      ticketId,
      {
        needsPart: true,
        status: TicketStatus.WAITING_PART,
        partId,
        partName: part.name,
        partQty: q,
      },
      `Reservada refacción: ${part.name} (x${q})`
    );

    addMovement({
      partId,
      type: 'RESERVE',
      qty: q,
      note: `Reserva para ticket ${ticketId}`,
      ticketId,
    });

    return { ok: true, message: 'Refacción reservada correctamente.' };
  };

  const releaseReservationForTicket = (ticketId: string, note?: string) => {
    if (!permissions.canReserve) return { ok: false, message: 'Permiso insuficiente para liberar reservas.' };

    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return { ok: false, message: 'Ticket no encontrado.' };

    if (!ticket.partId || !ticket.partQty) {
      return { ok: false, message: 'Este ticket no tiene refacción reservada.' };
    }

    setParts(prev =>
      prev.map(p => {
        if (p.id !== ticket.partId) return p;
        return { ...p, stockReserved: clampNonNeg(p.stockReserved - ticket.partQty!) };
      })
    );

    addMovement({
      partId: ticket.partId,
      type: 'RELEASE',
      qty: ticket.partQty,
      note: note || 'Liberación de reserva (DEMO)',
      ticketId,
    });

    // Mantener trazabilidad: no borramos partName/id, solo quitamos needsPart
    updateTicket(ticketId, { needsPart: false }, 'Reserva liberada');

    return { ok: true, message: 'Reserva liberada correctamente.' };
  };

  const issueReservedPartForTicket = (ticketId: string, note?: string) => {
    if (!permissions.canReserve) return { ok: false, message: 'Permiso insuficiente para consumir refacciones.' };

    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return { ok: false, message: 'Ticket no encontrado.' };

    if (!ticket.partId || !ticket.partQty) {
      return { ok: false, message: 'Este ticket no tiene refacción vinculada.' };
    }

    const part = parts.find(p => p.id === ticket.partId);
    if (!part) return { ok: false, message: 'Refacción no encontrada.' };

    const q = Math.max(1, Math.floor(ticket.partQty || 1));

    // Consumo: baja reservado y baja onHand
    setParts(prev =>
      prev.map(p => {
        if (p.id !== ticket.partId) return p;
        return {
          ...p,
          stockReserved: clampNonNeg(p.stockReserved - q),
          stockOnHand: clampNonNeg(p.stockOnHand - q),
        };
      })
    );

    addMovement({
      partId: ticket.partId,
      type: 'ISSUE',
      qty: q,
      note: note || 'Salida a mantenimiento (DEMO)',
      ticketId,
    });

    updateTicket(ticketId, { needsPart: false }, `Refacción utilizada: ${part.name} (x${q})`);

    return { ok: true, message: 'Refacción marcada como consumida.' };
  };

  const createPOForPart = (params: {
    partId: string;
    qty: number;
    vendor?: string;
    etaDays?: number;
    ticketId?: string;
  }) => {
    if (!permissions.canCreatePO) return { ok: false, message: 'Solo Gerencia puede generar OC (DEMO).' };

    const part = parts.find(p => p.id === params.partId);
    if (!part) return { ok: false, message: 'Refacción no encontrada.' };

    const q = Math.max(1, Math.floor(params.qty || 1));
    const vendor = params.vendor || part.preferredVendor || 'Proveedor (DEMO)';

    const now = new Date();
    const eta = new Date(now);
    eta.setDate(eta.getDate() + (params.etaDays ?? part.leadTimeDays ?? 3));

    const newPO: PurchaseOrder = {
      id: nextPOId(pos),
      status: POStatus.ORDERED,
      createdAt: now.toISOString(),
      createdBy: role,
      vendor,
      etaDate: eta.toISOString(),
      items: [{ partId: part.id, partName: part.name, qty: q, unit: part.unit }],
      notes: 'OC generada en DEMO (no implica compra real).',
    };

    setPos(prev => [newPO, ...prev]);

    addMovement({
      partId: part.id,
      type: 'PO_CREATED',
      qty: q,
      note: `OC ${newPO.id} creada (DEMO)`,
      poId: newPO.id,
      ticketId: params.ticketId,
    });

    if (params.ticketId) {
      updateTicket(params.ticketId, { poId: newPO.id }, `OC vinculada: ${newPO.id}`);
    }

    return { ok: true, message: `OC generada: ${newPO.id}`, poId: newPO.id };
  };

  const receivePO = (poId: string) => {
    if (!permissions.canCreatePO) return { ok: false, message: 'Solo Gerencia puede recibir OC (DEMO).' };

    const po = pos.find(p => p.id === poId);
    if (!po) return { ok: false, message: 'OC no encontrada.' };
    if (po.status === POStatus.RECEIVED) return { ok: false, message: 'Esta OC ya fue recibida.' };

    // Sumar al stockOnHand
    setParts(prev =>
      prev.map(p => {
        const item = po.items.find(i => i.partId === p.id);
        if (!item) return p;
        return { ...p, stockOnHand: p.stockOnHand + item.qty };
      })
    );

    // Movimientos por item
    po.items.forEach(item => {
      addMovement({
        partId: item.partId,
        type: 'RECEIVE',
        qty: item.qty,
        note: `Recepción OC ${po.id} (DEMO)`,
        poId: po.id,
      });
    });

    setPos(prev => prev.map(p => (p.id === poId ? { ...p, status: POStatus.RECEIVED } : p)));

    addMovement({
      partId: po.items[0]?.partId || 'P-000',
      type: 'PO_RECEIVED',
      qty: po.items.reduce((s, i) => s + i.qty, 0),
      note: `OC ${po.id} marcada como Recibida (DEMO)`,
      poId: po.id,
    });

    return { ok: true, message: `OC ${po.id} recibida y stock actualizado.` };
  };

  const adjustStock = (params: { partId: string; delta: number; note?: string }) => {
    if (!permissions.canAdjustStock) return { ok: false, message: 'Solo Gerencia puede ajustar stock (DEMO).' };

    const part = parts.find(p => p.id === params.partId);
    if (!part) return { ok: false, message: 'Refacción no encontrada.' };

    const delta = Math.trunc(params.delta || 0);
    if (delta === 0) return { ok: false, message: 'Delta inválido.' };

    setParts(prev =>
      prev.map(p => {
        if (p.id !== params.partId) return p;
        return { ...p, stockOnHand: clampNonNeg(p.stockOnHand + delta) };
      })
    );

    addMovement({
      partId: params.partId,
      type: 'ADJUST',
      qty: Math.abs(delta),
      note: params.note || `Ajuste de stock ${delta > 0 ? '+' : ''}${delta} (DEMO)`,
    });

    return { ok: true, message: 'Stock ajustado (DEMO).' };
  };

  // =========================
  // Reset & Export
  // =========================

  const resetDemoData = () => {
    const calculatedTickets = INITIAL_TICKETS.map(t => ({ ...t, priorityScore: calculatePriority(t) }));

    localStorage.removeItem('metodiko_demo_tickets');
    localStorage.removeItem('metodiko_demo_parts');
    localStorage.removeItem('metodiko_demo_pos');
    localStorage.removeItem('metodiko_demo_movements');

    setRole(Role.MANAGEMENT);
    setTickets(calculatedTickets);
    setParts(INITIAL_PARTS);
    setPos(INITIAL_POS);
    setMovements([]);
  };

  const exportCSV = () => {
    const headers = [
      'ID',
      'Habitacion',
      'Ocupada',
      'Activo',
      'Problema',
      'Estado',
      'Urgencia',
      'Impacto',
      'Prioridad',
      'Refaccion',
      'CantidadRefaccion',
      'OC',
      'Creado',
    ];

    const rows = tickets.map(t => [
      t.id,
      t.roomNumber,
      t.isOccupied ? 'SI' : 'NO',
      t.asset,
      t.issueType,
      t.status,
      t.urgency,
      t.impact,
      String(t.priorityScore),
      t.partName || '',
      t.partQty ? String(t.partQty) : '',
      t.poId || '',
      t.createdAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        headers.join(','),
        ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'reporte_mantenimiento_els.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // =========================
  // DEMO Scenarios
  // =========================

  const runScenario = (scenario: DemoScenario): string | null => {
    const actionable = [...tickets]
      .filter(t => t.status !== TicketStatus.VERIFIED)
      .sort((a, b) => b.priorityScore - a.priorityScore);

    const pickForBlock = actionable.find(t => [TicketStatus.OPEN, TicketStatus.IN_PROGRESS].includes(t.status));

    if (scenario === 'GUEST_COMPLAINT') {
      const t = buildTicket(
        tickets,
        {
          roomNumber: '105',
          isOccupied: true,
          asset: 'Aire Acondicionado',
          issueType: 'No enciende',
          description: 'Simulación DEMO: Huésped reporta que el aire no responde y no puede descansar.',
          urgency: Urgency.HIGH,
          impact: Impact.BLOCKING,
          status: TicketStatus.OPEN,
          createdBy: Role.RECEPTION,
          notes: [],
          needsPart: false,
          needsVendor: false,
        },
        Role.RECEPTION,
        'Ticket creado por Recepción (DEMO)'
      );

      setTickets(prev => [t, ...prev]);
      return t.id;
    }

    if (scenario === 'CLEANING_REPORT') {
      const t = buildTicket(
        tickets,
        {
          roomNumber: '112',
          isOccupied: false,
          asset: 'Plomería',
          issueType: 'Gotea',
          description: 'Simulación DEMO: Limpieza detecta goteo en lavabo durante preparación de habitación.',
          urgency: Urgency.MEDIUM,
          impact: Impact.ANNOYING,
          status: TicketStatus.OPEN,
          createdBy: Role.CLEANING,
          notes: [],
          needsPart: false,
          needsVendor: false,
        },
        Role.CLEANING,
        'Ticket creado por Limpieza (DEMO)'
      );

      setTickets(prev => [t, ...prev]);
      return t.id;
    }

    if (scenario === 'BLOCK_PART') {
      const id = pickForBlock?.id;
      const lowStockPart = parts.find(p => (p.stockOnHand - p.stockReserved) <= 0) || parts[0];

      if (id && lowStockPart) {
        updateTicketAs(
          Role.MAINTENANCE,
          id,
          {
            status: TicketStatus.WAITING_PART,
            needsPart: true,
            partId: lowStockPart.id,
            partName: lowStockPart.name,
            partQty: 1,
          },
          `Marcado espera refacción: ${lowStockPart.name} (DEMO)`
        );
        return id;
      }

      const t = buildTicket(
        tickets,
        {
          roomNumber: '101',
          isOccupied: true,
          asset: 'Eléctrico',
          issueType: 'Roto/Dañado',
          description: 'Simulación DEMO: Se requiere refacción para completar la reparación.',
          urgency: Urgency.HIGH,
          impact: Impact.BLOCKING,
          status: TicketStatus.WAITING_PART,
          createdBy: Role.MAINTENANCE,
          notes: ['Simulación DEMO: identificado componente a reemplazar.'],
          needsPart: true,
          partId: parts[0]?.id,
          partName: parts[0]?.name,
          partQty: 1,
          needsVendor: false,
        },
        Role.MAINTENANCE,
        'Ticket creado y marcado espera refacción (DEMO)'
      );

      setTickets(prev => [t, ...prev]);
      return t.id;
    }

    if (scenario === 'BLOCK_VENDOR') {
      const id = pickForBlock?.id;
      if (id) {
        updateTicketAs(
          Role.MAINTENANCE,
          id,
          {
            status: TicketStatus.VENDOR,
            needsVendor: true,
            vendorType: 'Proveedor DEMO (IT / HVAC / Cerrajería)',
          },
          'Marcado para proveedor (DEMO)'
        );
        return id;
      }

      const t = buildTicket(
        tickets,
        {
          roomNumber: '120',
          isOccupied: false,
          asset: 'TV/WiFi',
          issueType: 'Sin señal',
          description: 'Simulación DEMO: caso escalado a proveedor externo.',
          urgency: Urgency.LOW,
          impact: Impact.ANNOYING,
          status: TicketStatus.VENDOR,
          createdBy: Role.MAINTENANCE,
          notes: ['Simulación DEMO: reinicio no resuelve, se agenda visita.'],
          needsPart: false,
          needsVendor: true,
          vendorType: 'Proveedor DEMO',
        },
        Role.MAINTENANCE,
        'Ticket creado y escalado a proveedor (DEMO)'
      );

      setTickets(prev => [t, ...prev]);
      return t.id;
    }

    return null;
  };

  const value = useMemo(
    () => ({
      role,
      setRole,
      tickets,
      addTicket,
      updateTicket,

      parts,
      pos,
      movements,

      reservePartForTicket,
      releaseReservationForTicket,
      issueReservedPartForTicket,

      createPOForPart,
      receivePO,
      adjustStock,

      resetDemoData,
      exportCSV,
      runScenario,

      permissions,
    }),
    [
      role,
      tickets,
      parts,
      pos,
      movements,
      permissions,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
