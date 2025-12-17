// src/utils.ts

import {
  Impact,
  InventoryPart,
  Ticket,
  TicketStatus,
  Urgency,
} from './types';

// =========================
// Tickets
// =========================

// Simple heuristic for priority score
export const calculatePriority = (ticket: Ticket): number => {
  if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.VERIFIED) return 0;

  let score = 0;

  // Urgency
  if (ticket.urgency === Urgency.HIGH) score += 50;
  if (ticket.urgency === Urgency.MEDIUM) score += 30;
  if (ticket.urgency === Urgency.LOW) score += 10;

  // Impact
  if (ticket.impact === Impact.BLOCKING) score += 40;
  if (ticket.impact === Impact.ANNOYING) score += 20;

  // Occupancy
  if (ticket.isOccupied) score += 30;

  // Age (Days open) - Max 30 points
  const daysOpen =
    (new Date().getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 3600 * 24);
  score += Math.min(daysOpen * 5, 30);

  return Math.round(score);
};

export const getStatusColor = (status: TicketStatus) => {
  switch (status) {
    case TicketStatus.OPEN:
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case TicketStatus.IN_PROGRESS:
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case TicketStatus.WAITING_PART:
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case TicketStatus.VENDOR:
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case TicketStatus.RESOLVED:
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case TicketStatus.VERIFIED:
      return 'bg-slate-100 text-slate-800 border-slate-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getUrgencyColor = (urgency: Urgency) => {
  switch (urgency) {
    case Urgency.HIGH:
      return 'text-rose-600 font-bold';
    case Urgency.MEDIUM:
      return 'text-amber-600 font-medium';
    default:
      return 'text-slate-500';
  }
};

// =========================
// Inventario
// =========================

export const clampNonNeg = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

export const getAvailableStock = (part: InventoryPart) =>
  clampNonNeg((part.stockOnHand ?? 0) - (part.stockReserved ?? 0));

export const isOutOfStock = (part: InventoryPart) => getAvailableStock(part) <= 0;

export const isLowStock = (part: InventoryPart) => {
  const available = getAvailableStock(part);
  const min = part.minStock ?? 0;
  if (min <= 0) return false;
  return available > 0 && available <= min;
};

export const shouldReorder = (part: InventoryPart) => {
  const available = getAvailableStock(part);
  const min = part.minStock ?? 0;
  return available <= min;
};

export const suggestedReorderQty = (part: InventoryPart) => {
  // DEMO: reorden sugerido = (minStock * 2) - available, mínimo 1
  const available = getAvailableStock(part);
  const min = part.minStock ?? 0;
  const target = Math.max(2, min * 2);
  return Math.max(1, target - available);
};

export const getStockBadge = (part: InventoryPart) => {
  const available = getAvailableStock(part);
  if (available <= 0) {
    return {
      label: 'SIN STOCK',
      className: 'bg-rose-50 text-rose-700 border border-rose-200',
    };
  }
  if (isLowStock(part)) {
    return {
      label: 'BAJO STOCK',
      className: 'bg-amber-50 text-amber-700 border border-amber-200',
    };
  }
  return {
    label: 'OK',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  };
};

export const getPartIdFromTicket = (ticket: Ticket) => {
  // Compat DEMO: si no hay partId, al menos devolvemos undefined sin romper UI.
  return ticket.partId || undefined;
};
